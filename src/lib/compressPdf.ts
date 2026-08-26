import { PDFDocument } from "pdf-lib";

// Next.js/TS types Blob parts as ArrayBufferView<ArrayBuffer>, but pdf-lib
// and pdf.js can return Uint8Array backed by a generic ArrayBufferLike.
// Copying into a fresh Uint8Array guarantees a plain ArrayBuffer backing.
function toBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy], { type });
}

export type PdfPreset = "leger" | "recommande" | "fort";

// Le mode "léger" garde le texte sélectionnable (recompression légère de la
// structure du PDF). Les modes "recommandé" et "fort" transforment chaque
// page en image (comme le font la plupart des compresseurs PDF en ligne) :
// gain de taille très important sur les PDF scannés ou riches en images.
// Mais pour un PDF déjà basé sur du texte/vectoriel (export Word, document
// administratif), rasteriser peut produire un fichier PLUS LOURD que
// l'original — le texte vectoriel est déjà très compact. On protège donc
// systématiquement contre ce cas : si le résultat n'est pas plus petit que
// l'original, on retente une méthode plus sûre, puis en dernier recours on
// renvoie le fichier d'origine inchangé plutôt qu'un résultat dégradé et
// plus lourd.
const RASTER_PRESETS: Record<
  Exclude<PdfPreset, "leger">,
  { scale: number; quality: number }
> = {
  recommande: { scale: 1.35, quality: 0.65 },
  fort: { scale: 1.0, quality: 0.4 },
};

export interface CompressedPdfResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  fileName: string;
  rasterized: boolean;
  unchanged: boolean; // true si le fichier d'origine a été renvoyé tel quel
}

async function safeReencode(originalBuffer: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(originalBuffer, { updateMetadata: false });
  doc.setTitle("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("");
  doc.setCreator("");
  return doc.save({ useObjectStreams: true });
}

async function rasterize(
  originalBuffer: ArrayBuffer,
  scale: number,
  quality: number,
  onProgress?: (percent: number) => void
): Promise<Uint8Array> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const sourceDoc = await pdfjsLib.getDocument({ data: originalBuffer.slice(0) }).promise;
  const outputDoc = await PDFDocument.create();

  for (let pageNum = 1; pageNum <= sourceDoc.numPages; pageNum++) {
    const page = await sourceDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Impossible de créer le contexte de rendu.");

    await page.render({ canvasContext: context, viewport }).promise;

    const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
    const jpegBytes = dataUrlToUint8Array(jpegDataUrl);
    const embeddedImage = await outputDoc.embedJpg(jpegBytes);

    const originalViewport = page.getViewport({ scale: 1 });
    const newPage = outputDoc.addPage([originalViewport.width, originalViewport.height]);
    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: originalViewport.width,
      height: originalViewport.height,
    });

    onProgress?.(Math.round((pageNum / sourceDoc.numPages) * 100));

    canvas.width = 0;
    canvas.height = 0;
  }

  return outputDoc.save();
}

export async function compressPdfFile(
  file: File,
  preset: PdfPreset,
  onProgress?: (percent: number) => void
): Promise<CompressedPdfResult> {
  const result = await compressPdfFileInner(file, preset, onProgress);

  // Garde-fou final, absolu : quel que soit le chemin de code emprunté
  // ci-dessus, on ne renvoie JAMAIS un fichier plus lourd (ni même égal en
  // pratique) que l'original. C'est la dernière ligne de défense, pas la
  // seule — mais elle rend le bug "fichier plus gros après compression"
  // structurellement impossible.
  if (result.compressedSize >= file.size) {
    return buildUnchangedResult(file);
  }
  return result;
}

async function compressPdfFileInner(
  file: File,
  preset: PdfPreset,
  onProgress?: (percent: number) => void
): Promise<CompressedPdfResult> {
  const originalBuffer = await file.arrayBuffer();
  const originalSize = file.size;
  // Marge de sécurité : un gain de moins de 2% n'est pas un vrai gain une
  // fois l'en-tête HTTP/disque pris en compte, autant garder l'original.
  const MIN_MEANINGFUL_GAIN = 0.98;

  if (preset === "leger") {
    const bytes = await safeReencode(originalBuffer);
    onProgress?.(100);
    if (bytes.byteLength >= originalSize * MIN_MEANINGFUL_GAIN) {
      return buildUnchangedResult(file);
    }
    return {
      blob: toBlob(bytes, "application/pdf"),
      originalSize,
      compressedSize: bytes.byteLength,
      fileName: buildOutputName(file.name),
      rasterized: false,
      unchanged: false,
    };
  }

  // Modes "recommandé" et "fort" : on tente d'abord la rasterisation.
  const { scale, quality } = RASTER_PRESETS[preset];
  let rasterBytes: Uint8Array | null = null;
  try {
    rasterBytes = await rasterize(originalBuffer, scale, quality, onProgress);
  } catch {
    rasterBytes = null; // on retombera sur la méthode sûre ci-dessous
  }

  if (rasterBytes && rasterBytes.byteLength < originalSize * MIN_MEANINGFUL_GAIN) {
    return {
      blob: toBlob(rasterBytes, "application/pdf"),
      originalSize,
      compressedSize: rasterBytes.byteLength,
      fileName: buildOutputName(file.name),
      rasterized: true,
      unchanged: false,
    };
  }

  // La rasterisation n'a pas aidé (PDF déjà à base de texte compact) :
  // on retente la méthode sûre qui préserve le texte.
  const safeBytes = await safeReencode(originalBuffer);
  onProgress?.(100);
  if (safeBytes.byteLength < originalSize * MIN_MEANINGFUL_GAIN) {
    return {
      blob: toBlob(safeBytes, "application/pdf"),
      originalSize,
      compressedSize: safeBytes.byteLength,
      fileName: buildOutputName(file.name),
      rasterized: false,
      unchanged: false,
    };
  }

  // Rien n'a permis de réduire la taille : le PDF est déjà optimisé.
  return buildUnchangedResult(file);
}

async function buildUnchangedResult(file: File): Promise<CompressedPdfResult> {
  return {
    blob: file.slice(0, file.size, "application/pdf"),
    originalSize: file.size,
    compressedSize: file.size,
    fileName: buildOutputName(file.name),
    rasterized: false,
    unchanged: true,
  };
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildOutputName(originalName: string): string {
  const dotIndex = originalName.lastIndexOf(".");
  const base = dotIndex === -1 ? originalName : originalName.slice(0, dotIndex);
  return `${base}-compresse.pdf`;
}

import imageCompression from "browser-image-compression";

export type ImagePreset = "leger" | "recommande" | "fort";

const PRESETS: Record<
  ImagePreset,
  { maxSizeMB: number; maxWidthOrHeight: number; initialQuality: number }
> = {
  leger: { maxSizeMB: 4, maxWidthOrHeight: 2560, initialQuality: 0.85 },
  recommande: { maxSizeMB: 2, maxWidthOrHeight: 1920, initialQuality: 0.7 },
  fort: { maxSizeMB: 1, maxWidthOrHeight: 1280, initialQuality: 0.5 },
};

export interface CompressedResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  fileName: string;
}

export async function compressImageFile(
  file: File,
  preset: ImagePreset,
  onProgress?: (percent: number) => void
): Promise<CompressedResult> {
  const options = {
    ...PRESETS[preset],
    useWebWorker: true,
    onProgress,
  };

  const compressedBlob = await imageCompression(file, options);

  return {
    blob: compressedBlob,
    originalSize: file.size,
    compressedSize: compressedBlob.size,
    fileName: buildOutputName(file.name),
  };
}

function buildOutputName(originalName: string): string {
  const dotIndex = originalName.lastIndexOf(".");
  const base = dotIndex === -1 ? originalName : originalName.slice(0, dotIndex);
  const ext = dotIndex === -1 ? "jpg" : originalName.slice(dotIndex + 1);
  return `${base}-compresse.${ext}`;
}

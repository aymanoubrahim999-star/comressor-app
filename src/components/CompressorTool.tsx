"use client";

import { useCallback, useRef, useState } from "react";
import JSZip from "jszip";
import { compressImageFile, type ImagePreset } from "@/lib/compressImage";
import { compressPdfFile, type PdfPreset } from "@/lib/compressPdf";
import { formatBytes, percentSaved } from "@/lib/format";
import { SizeGauge } from "./SizeGauge";

type Preset = ImagePreset | PdfPreset;
type FileKind = "image" | "pdf" | "unsupported";
type Status = "attente" | "compression" | "termine" | "erreur";

interface QueueItem {
  id: string;
  file: File;
  kind: FileKind;
  status: Status;
  progress: number | null;
  compressedBlob: Blob | null;
  compressedSize: number | null;
  outputName: string;
  rasterized: boolean;
  unchanged: boolean;
  errorMessage: string | null;
}

const PRESETS: { id: Preset; label: string; description: string }[] = [
  {
    id: "leger",
    label: "Léger",
    description: "Qualité quasi intacte. Texte PDF conservé et sélectionnable.",
  },
  {
    id: "recommande",
    label: "Recommandé",
    description: "Bon équilibre taille / qualité. Idéal pour l'envoi par email.",
  },
  {
    id: "fort",
    label: "Fort",
    description: "Taille minimale. Le PDF est transformé en images (texte non sélectionnable).",
  },
];

function detectKind(file: File): FileKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  return "unsupported";
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function CompressorTool() {
  const [preset, setPreset] = useState<Preset>("recommande");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newItems: QueueItem[] = Array.from(fileList).map((file) => ({
      id: makeId(),
      file,
      kind: detectKind(file),
      status: "attente",
      progress: null,
      compressedBlob: null,
      compressedSize: null,
      outputName: file.name,
      rasterized: false,
      unchanged: false,
      errorMessage: null,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const processItem = useCallback(
    async (item: QueueItem) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "compression", progress: 0 } : it
        )
      );

      try {
        if (item.kind === "image") {
          const result = await compressImageFile(
            item.file,
            preset as ImagePreset,
            (p) =>
              setItems((prev) =>
                prev.map((it) => (it.id === item.id ? { ...it, progress: p } : it))
              )
          );
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: "termine",
                    progress: 100,
                    compressedBlob: result.blob,
                    compressedSize: result.compressedSize,
                    outputName: result.fileName,
                  }
                : it
            )
          );
        } else if (item.kind === "pdf") {
          const result = await compressPdfFile(
            item.file,
            preset as PdfPreset,
            (p) =>
              setItems((prev) =>
                prev.map((it) => (it.id === item.id ? { ...it, progress: p } : it))
              )
          );
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: "termine",
                    progress: 100,
                    compressedBlob: result.blob,
                    compressedSize: result.compressedSize,
                    outputName: result.fileName,
                    rasterized: result.rasterized,
                    unchanged: result.unchanged,
                  }
                : it
            )
          );
        }
      } catch (err) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "erreur",
                  errorMessage:
                    err instanceof Error ? err.message : "Erreur inconnue.",
                }
              : it
          )
        );
      }
    },
    [preset]
  );

  const compressAll = useCallback(() => {
    const pending = items.filter(
      (it) => it.status === "attente" && it.kind !== "unsupported"
    );
    pending.forEach((it) => processItem(it));
  }, [items, processItem]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const downloadAllAsZip = useCallback(async () => {
    const done = items.filter((it) => it.status === "termine" && it.compressedBlob);
    if (done.length === 0) return;
    const zip = new JSZip();
    done.forEach((it) => zip.file(it.outputName, it.compressedBlob!));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fichiers-compresses.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  const hasPending = items.some((it) => it.status === "attente");
  const doneCount = items.filter((it) => it.status === "termine").length;
  const totalOriginal = items.reduce((s, it) => s + it.file.size, 0);
  const totalCompressed = items
    .filter((it) => it.compressedSize !== null)
    .reduce((s, it) => s + (it.compressedSize ?? 0), 0);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Dropzone — le cœur de l'outil */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`cursor-pointer rounded-sm border-2 border-dashed transition-colors px-6 py-14 text-center ${
          isDragging
            ? "border-signal-after bg-signal-after/5"
            : "border-ink-line hover:border-paper-dim"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <p className="font-display font-extrabold text-xl md:text-2xl text-paper">
          Glissez vos images ou PDF ici
        </p>
        <p className="mt-2 text-sm text-paper-dim">
          ou cliquez pour parcourir — JPG, PNG, WebP, PDF. Rien n&apos;est envoyé sur un serveur.
        </p>
      </div>

      {/* Sélecteur de préréglage */}
      <div className="mt-6">
        <p className="font-mono text-xs uppercase tracking-wider text-paper-dim mb-2">
          Niveau de compression
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`text-left rounded-sm border px-3 py-2.5 transition-colors ${
                preset === p.id
                  ? "border-signal-after bg-signal-after/10"
                  : "border-ink-line hover:border-paper-dim"
              }`}
            >
              <span className="block font-display font-bold text-sm text-paper">
                {p.label}
              </span>
              <span className="block text-xs text-paper-dim mt-0.5 leading-snug">
                {p.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Action */}
      {items.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={compressAll}
            disabled={!hasPending}
            className="font-display font-bold text-sm bg-signal-after text-ink px-5 py-2.5 rounded-sm disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition"
          >
            Compresser {items.filter((it) => it.status === "attente").length > 0 ? `(${items.filter((it) => it.status === "attente").length})` : ""}
          </button>
          {doneCount > 1 && (
            <button
              onClick={downloadAllAsZip}
              className="font-display font-bold text-sm border border-ink-line text-paper px-5 py-2.5 rounded-sm hover:border-paper-dim transition"
            >
              Tout télécharger (.zip)
            </button>
          )}
          {doneCount > 0 && (
            <span className="font-mono text-xs text-paper-dim ml-auto">
              Total : {formatBytes(totalOriginal)} → {formatBytes(totalCompressed)}{" "}
              <span className="text-signal-after">
                (−{percentSaved(totalOriginal, totalCompressed)}%)
              </span>
            </span>
          )}
        </div>
      )}

      {/* File de fichiers */}
      <div className="mt-6 flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-sm border border-ink-line bg-ink-raised p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-paper">
                  {item.file.name}
                </p>
                {item.kind === "unsupported" && (
                  <p className="text-xs text-signal-before mt-1">
                    Format non supporté — utilisez une image ou un PDF.
                  </p>
                )}
                {item.status === "erreur" && (
                  <p className="text-xs text-signal-before mt-1">
                    Échec : {item.errorMessage}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.status === "termine" && item.compressedBlob && (
                  <a
                    href={URL.createObjectURL(item.compressedBlob)}
                    download={item.outputName}
                    className="font-display font-bold text-xs bg-signal-after text-ink px-3 py-1.5 rounded-sm hover:brightness-110 transition"
                  >
                    Télécharger
                  </a>
                )}
                <button
                  onClick={() => removeItem(item.id)}
                  aria-label="Retirer ce fichier"
                  className="text-paper-dim hover:text-paper text-lg leading-none px-1"
                >
                  ×
                </button>
              </div>
            </div>

            {item.kind !== "unsupported" && (
              <div className="mt-3">
                <SizeGauge
                  originalSize={item.file.size}
                  compressedSize={item.compressedSize}
                  progress={item.status === "compression" ? item.progress : null}
                />
                {item.status === "termine" && item.unchanged && (
                  <p className="mt-2 text-xs text-paper-dim">
                    Ce fichier était déjà optimisé — aucune réduction supplémentaire n&apos;était possible sans perte de qualité. Le fichier d&apos;origine vous est renvoyé tel quel.
                  </p>
                )}
                {item.status === "termine" && item.rasterized && !item.unchanged && (
                  <p className="mt-2 text-xs text-signal-before/90">
                    ⚠ Ce PDF a été converti en images pour maximiser la compression : le texte n&apos;est plus sélectionnable ni copiable.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

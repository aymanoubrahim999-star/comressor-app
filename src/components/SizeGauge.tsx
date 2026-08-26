import { formatBytes, percentSaved } from "@/lib/format";

interface SizeGaugeProps {
  originalSize: number;
  compressedSize: number | null;
  progress: number | null; // 0-100 while processing, null when idle/done
}

export function SizeGauge({
  originalSize,
  compressedSize,
  progress,
}: SizeGaugeProps) {
  const isDone = compressedSize !== null;
  const saved = isDone ? percentSaved(originalSize, compressedSize!) : 0;
  const compressedRatio = isDone
    ? Math.min(1, compressedSize! / originalSize)
    : 1;

  return (
    <div className="w-full">
      <div className="relative h-8 w-full rounded-sm bg-ink-line overflow-hidden">
        {/* Barre "avant" — pleine largeur, ambre */}
        <div className="absolute inset-y-0 left-0 w-full bg-signal-before/90" />
        {/* Barre "après" — se referme depuis la droite pendant le traitement */}
        <div
          className="absolute inset-y-0 left-0 bg-signal-after transition-[width] duration-700 ease-out"
          style={{
            width:
              progress !== null
                ? `${progress}%`
                : isDone
                ? `${compressedRatio * 100}%`
                : "0%",
          }}
        />
        {progress !== null && !isDone && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-ink font-semibold">
            {progress}%
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-xs text-paper-dim">
        <span>
          <span className="text-signal-before">●</span> {formatBytes(originalSize)}
        </span>
        {isDone ? (
          <span className="text-paper font-semibold">
            <span className="text-signal-after">●</span> {formatBytes(compressedSize!)}
            <span className="ml-2 text-signal-after">−{saved}%</span>
          </span>
        ) : (
          <span>{progress !== null ? "compression…" : "en attente"}</span>
        )}
      </div>
    </div>
  );
}

export interface DownloadProgress {
  stage: "resolving" | "connecting" | "transferring" | "validating";
  received: number;
  total: number | null;
  bytesPerSecond: number;
}

export function downloadProgressText(progress: DownloadProgress): string {
  if (progress.stage === "resolving") return "Preparing audio download";
  if (progress.stage === "connecting") return "Connecting to audio source";
  if (progress.stage === "validating") return "Checking downloaded audio";
  const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
  const percent = progress.total ? `${Math.min(100, Math.floor(progress.received / progress.total * 100))}% · ` : "";
  return `${percent}${mb(progress.received)}${progress.total ? ` of ${mb(progress.total)}` : ""}${progress.bytesPerSecond > 0 ? ` · ${mb(progress.bytesPerSecond)}/s` : ""}`;
}

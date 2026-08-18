export function formatScheduleReleaseCountdown(
  releaseAtIso: string | null | undefined,
  now = Date.now(),
  audience = "Assignees",
) {
  const fallback = `${audience} notified after this change is released`;
  if (!releaseAtIso) return fallback;

  const releaseAt = new Date(releaseAtIso).getTime();
  if (!Number.isFinite(releaseAt)) return fallback;

  const minutes = Math.ceil((releaseAt - now) / 60_000);
  if (minutes <= 0) return `${audience} notified now`;
  return `${audience} notified in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

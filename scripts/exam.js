export const TARGET_PERCENT = 80;

export function minimumPassingCount(total) {
  return Math.floor(total * TARGET_PERCENT / 100) + 1;
}

export function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const minutes = String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0');
  const hours = Math.floor(totalSeconds / 3600);
  return hours ? `${String(hours).padStart(2, '0')}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

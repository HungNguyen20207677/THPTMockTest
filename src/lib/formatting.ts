export const vietnamDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

export const scoreFormatter = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours} giờ`);
  }

  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes} phút`);
  }

  parts.push(`${seconds} giây`);
  return parts.join(" ");
}

export function formatScore(score: number | null): string {
  return score === null ? "Chưa có" : scoreFormatter.format(score);
}

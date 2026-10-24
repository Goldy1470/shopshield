const whenFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function fmtWhen(d: Date): string {
  return whenFmt.format(d).replace(",", "");
}

export function fmtDay(d: Date): string {
  return dayFmt.format(d);
}

export function fmtDaysUntil(due: Date): string {
  const ms = due.getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (ms <= 0) return "past due";
  if (days === 1) return "due in 1 day";
  return `due in ${days} days`;
}

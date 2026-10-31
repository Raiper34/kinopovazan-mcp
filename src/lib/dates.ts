import { config } from "./config";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function weekday(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function isValidMonth(value: string): boolean {
  const m = ISO_MONTH.exec(value);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function monthsBetween(fromIso: string, toIso: string): string[] {
  const months: string[] = [];
  for (
    let month = monthOf(fromIso);
    month <= monthOf(toIso);
    month = addMonths(month, 1)
  ) {
    months.push(month);
  }
  return months;
}

/**
 * Accepts "today", "tomorrow" or "YYYY-MM-DD" and returns "YYYY-MM-DD"
 * (interpreted in the cinema's time zone).
 */
export function resolveDate(input: string | undefined): string {
  const today = todayIso();
  const value = (input ?? "today").trim().toLowerCase();
  if (value === "today" || value === "") return today;
  if (value === "tomorrow") return addDays(today, 1);
  if (!isValidIsoDate(value)) {
    throw new Error(
      `Invalid date "${input}". Use YYYY-MM-DD, "today" or "tomorrow".`
    );
  }
  return value;
}

/**
 * Calendar dates as "YYYY-MM-DD" strings, no time, no timezone. Arithmetic is
 * done through Date.UTC so DST never shifts a day.
 */
export type IsoDate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string): boolean {
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toUtc(d: IsoDate): Date {
  const m = ISO_RE.exec(d);
  if (!m) throw new RangeError(`not an ISO date: ${d}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function fromUtc(dt: Date): IsoDate {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date in the user's local calendar. */
export function todayIso(now: Date = new Date()): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(d: IsoDate, n: number): IsoDate {
  const dt = toUtc(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUtc(dt);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(d: IsoDate): number {
  return toUtc(d).getUTCDay();
}

export function ymd(d: IsoDate): { year: number; month: number; day: number } {
  const dt = toUtc(d);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export function makeIso(year: number, month: number, day: number): IsoDate {
  return fromUtc(new Date(Date.UTC(year, month - 1, day)));
}

/** ISO strings compare lexicographically. */
export function compareIso(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

import { addDays, compareIso, makeIso, weekday, ymd, type IsoDate } from './dates';

export type Frequency = 'none' | 'weekly' | 'monthly';

export interface Schedule {
  frequency: Frequency;
  /** weekly: 0-6 (0 = Sunday). monthly: 1-28. */
  day: number;
  /** First possible payday. */
  startDate: IsoDate;
}

export function allowanceTxId(kidId: string, date: IsoDate): string {
  return `allowance:${kidId}:${date}`;
}

export function isValidDay(frequency: Frequency, day: number): boolean {
  if (!Number.isInteger(day)) return false;
  if (frequency === 'weekly') return day >= 0 && day <= 6;
  if (frequency === 'monthly') return day >= 1 && day <= 28;
  return true;
}

/** First payday on or after `from`. */
function firstOnOrAfter(s: Schedule, from: IsoDate): IsoDate {
  if (s.frequency === 'weekly') {
    const diff = (s.day - weekday(from) + 7) % 7;
    return addDays(from, diff);
  }
  const { year, month, day } = ymd(from);
  if (day <= s.day) return makeIso(year, month, s.day);
  return makeIso(year, month + 1, s.day); // makeIso normalizes month 13
}

function next(s: Schedule, d: IsoDate): IsoDate {
  if (s.frequency === 'weekly') return addDays(d, 7);
  const { year, month } = ymd(d);
  return makeIso(year, month + 1, s.day);
}

/** All paydays from startDate up to and including `today`, ascending. */
export function paydays(s: Schedule, today: IsoDate): IsoDate[] {
  if (s.frequency === 'none' || !isValidDay(s.frequency, s.day)) return [];
  const out: IsoDate[] = [];
  let d = firstOnOrAfter(s, s.startDate);
  // Hard cap protects against a bad startDate far in the past.
  while (compareIso(d, today) <= 0 && out.length < 10_000) {
    out.push(d);
    d = next(s, d);
  }
  return out;
}

/** First payday strictly after `today`, or null when there is none. */
export function nextPayday(s: Schedule, today: IsoDate): IsoDate | null {
  if (s.frequency === 'none' || !isValidDay(s.frequency, s.day)) return null;
  const from = compareIso(s.startDate, today) > 0 ? s.startDate : addDays(today, 1);
  return firstOnOrAfter(s, from);
}

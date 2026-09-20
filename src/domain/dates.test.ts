import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isIsoDate, makeIso, todayIso, weekday, ymd } from './dates';

describe('dates', () => {
  it('validates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('26-01-01')).toBe(false);
    expect(isIsoDate('2026-1-1')).toBe(false);
  });
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-01-01', 0)).toBe('2026-01-01');
  });
  it('weekday: 2026-09-20 is a Sunday', () => {
    expect(weekday('2026-09-20')).toBe(0);
    expect(weekday('2026-09-21')).toBe(1);
  });
  it('makeIso normalizes month overflow', () => {
    expect(makeIso(2026, 13, 5)).toBe('2027-01-05');
    expect(ymd('2026-09-20')).toEqual({ year: 2026, month: 9, day: 20 });
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-09-20', '2026-09-27')).toBe(7);
    expect(daysBetween('2026-09-27', '2026-09-20')).toBe(-7);
  });
  it('todayIso uses local calendar', () => {
    expect(todayIso(new Date(2026, 8, 20, 23, 59))).toBe('2026-09-20');
  });
});

import { describe, expect, it } from 'vitest';
import { allowanceTxId, isValidDay, nextPayday, paydays, type Schedule } from './allowance';
import { addDays, weekday } from './dates';

const TODAY = '2026-09-20'; // Sunday

describe('paydays weekly', () => {
  it('spec acceptance: started 3 weeks ago yields 3 or 4 rows depending on weekday', () => {
    const start = addDays(TODAY, -21); // 2026-08-30, also a Sunday
    for (let day = 0; day <= 6; day++) {
      const s: Schedule = { frequency: 'weekly', day, startDate: start };
      const list = paydays(s, TODAY);
      // Sunday start + Sunday today: day 0 gives 4 (start, +7, +14, +21=today), others give 3.
      expect(list.length).toBe(day === 0 ? 4 : 3);
      for (const d of list) expect(weekday(d)).toBe(day);
      expect(list.every((d) => d >= start && d <= TODAY)).toBe(true);
    }
  });
  it('includes startDate when it falls on the day', () => {
    expect(paydays({ frequency: 'weekly', day: 0, startDate: TODAY }, TODAY)).toEqual([TODAY]);
  });
  it('empty when start is in the future', () => {
    expect(paydays({ frequency: 'weekly', day: 0, startDate: '2026-09-27' }, TODAY)).toEqual([]);
  });
});

describe('paydays monthly', () => {
  it('walks month by month from the first eligible date', () => {
    const s: Schedule = { frequency: 'monthly', day: 15, startDate: '2026-06-20' };
    expect(paydays(s, TODAY)).toEqual(['2026-07-15', '2026-08-15', '2026-09-15']);
  });
  it('start on the day itself counts', () => {
    const s: Schedule = { frequency: 'monthly', day: 1, startDate: '2026-09-01' };
    expect(paydays(s, TODAY)).toEqual(['2026-09-01']);
  });
  it('crosses year end', () => {
    const s: Schedule = { frequency: 'monthly', day: 28, startDate: '2025-11-01' };
    expect(paydays(s, '2026-02-28')).toEqual([
      '2025-11-28',
      '2025-12-28',
      '2026-01-28',
      '2026-02-28',
    ]);
  });
});

describe('none / invalid', () => {
  it('none gives nothing', () => {
    expect(paydays({ frequency: 'none', day: 0, startDate: '2020-01-01' }, TODAY)).toEqual([]);
    expect(nextPayday({ frequency: 'none', day: 0, startDate: '2020-01-01' }, TODAY)).toBeNull();
  });
  it('invalid day gives nothing', () => {
    expect(paydays({ frequency: 'weekly', day: 7, startDate: '2020-01-01' }, TODAY)).toEqual([]);
    expect(paydays({ frequency: 'monthly', day: 29, startDate: '2020-01-01' }, TODAY)).toEqual([]);
    expect(isValidDay('monthly', 28)).toBe(true);
    expect(isValidDay('weekly', 1.5)).toBe(false);
  });
});

describe('nextPayday', () => {
  it('is strictly after today', () => {
    expect(nextPayday({ frequency: 'weekly', day: 0, startDate: '2026-01-04' }, TODAY)).toBe(
      '2026-09-27',
    );
    expect(nextPayday({ frequency: 'monthly', day: 20, startDate: '2026-01-20' }, TODAY)).toBe(
      '2026-10-20',
    );
    expect(nextPayday({ frequency: 'monthly', day: 21, startDate: '2026-01-21' }, TODAY)).toBe(
      '2026-09-21',
    );
  });
  it('respects a future startDate', () => {
    expect(nextPayday({ frequency: 'weekly', day: 3, startDate: '2026-10-01' }, TODAY)).toBe(
      '2026-10-07',
    );
  });
});

describe('allowanceTxId', () => {
  it('is deterministic', () => {
    expect(allowanceTxId('k1', '2026-09-20')).toBe('allowance:k1:2026-09-20');
  });
});

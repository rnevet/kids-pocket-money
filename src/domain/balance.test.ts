import { describe, expect, it } from 'vitest';
import { balances, dedupeById, sortNewestFirst } from './balance';
import type { Transaction } from './schema';

const t = (
  id: string,
  kidId: string,
  amount: number,
  date = '2026-09-20',
  createdAt = '2026-09-20T10:00:00.000Z',
): Transaction => ({
  id,
  kidId,
  date,
  amount,
  type: 'deposit',
  note: '',
  createdBy: '',
  createdAt,
});

describe('balances', () => {
  it('sums per kid and ignores duplicate ids (race duplicates)', () => {
    const rows = [t('a', 'k1', 1000), t('b', 'k1', -250), t('a', 'k1', 1000), t('c', 'k2', 500)];
    expect(balances(rows)).toEqual(
      new Map([
        ['k1', 750],
        ['k2', 500],
      ]),
    );
  });
  it('dedupe keeps the first occurrence', () => {
    expect(dedupeById([t('a', 'k1', 1), t('a', 'k1', 2)])).toEqual([t('a', 'k1', 1)]);
  });
  it('sorts newest first by date then createdAt', () => {
    const rows = [
      t('a', 'k', 1, '2026-09-18'),
      t('b', 'k', 1, '2026-09-20', '2026-09-20T09:00:00.000Z'),
      t('c', 'k', 1, '2026-09-20', '2026-09-20T11:00:00.000Z'),
    ];
    expect(sortNewestFirst(rows).map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });
});

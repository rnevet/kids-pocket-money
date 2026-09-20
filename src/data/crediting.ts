import { allowanceTxId, paydays } from '../domain/allowance';
import type { IsoDate } from '../domain/dates';
import { nowTimestamp, type Transaction } from '../domain/schema';
import type { Family, Repository } from './repository';

/** Pure: which allowance rows are missing for the family as of `today`. */
export function missingAllowances(
  family: Family,
  today: IsoDate,
  createdBy: string,
): Transaction[] {
  const existing = new Set(family.transactions.map((t) => t.id));
  const out: Transaction[] = [];
  const createdAt = nowTimestamp();
  for (const kid of family.kids) {
    if (kid.archived || kid.allowanceFrequency === 'none' || kid.allowanceAmount <= 0) continue;
    const dates = paydays(
      { frequency: kid.allowanceFrequency, day: kid.allowanceDay, startDate: kid.startDate },
      today,
    );
    for (const date of dates) {
      const id = allowanceTxId(kid.id, date);
      if (existing.has(id)) continue;
      out.push({
        id,
        kidId: kid.id,
        date,
        amount: kid.allowanceAmount,
        type: 'allowance',
        note: '',
        createdBy,
        createdAt,
      });
    }
  }
  return out;
}

/**
 * Append missing allowance rows. `family` must come from a fresh load. Returns
 * how many rows were appended; the caller reloads when > 0.
 */
export async function creditAllowances(
  repo: Repository,
  family: Family,
  today: IsoDate,
  createdBy: string,
): Promise<number> {
  const rows = missingAllowances(family, today, createdBy);
  if (rows.length > 0) await repo.appendTransactions(family.fileId, rows);
  return rows.length;
}

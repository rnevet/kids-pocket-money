import { sum, type Minor } from './money';
import type { Transaction } from './schema';

/**
 * Keep the first row per id, in sheet order. Concurrent allowance crediting
 * by two parents can produce duplicate rows; this makes them harmless.
 */
export function dedupeById<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export function balances(transactions: readonly Transaction[]): Map<string, Minor> {
  const byKid = new Map<string, Minor[]>();
  for (const t of dedupeById(transactions)) {
    const list = byKid.get(t.kidId) ?? [];
    list.push(t.amount);
    byKid.set(t.kidId, list);
  }
  return new Map([...byKid].map(([kid, amounts]) => [kid, sum(amounts)]));
}

/** Newest first: by date, then createdAt, then sheet order (stable sort). */
export function sortNewestFirst(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
  });
}

import { describe, expect, it } from 'vitest';
import { FakeSheets } from '../test/fakeSheets';
import { createRepository } from './repository';
import { createFamilySheet } from './bootstrap';
import { creditAllowances, missingAllowances } from './crediting';
import type { Kid } from '../domain/schema';
import type { Drive } from '../google/drive';

const fakeDrive = { markAsAppFile: async () => ({ id: 'sheet-1', name: 'x' }) } as unknown as Drive;
const TODAY = '2026-09-20'; // Sunday

const kid = (over: Partial<Kid> = {}): Kid => ({
  id: 'k1',
  name: 'Noa',
  avatar: '',
  currency: 'ILS',
  allowanceAmount: 2000,
  allowanceFrequency: 'weekly',
  allowanceDay: 0,
  startDate: '2026-08-30',
  archived: false,
  updatedAt: '2026-08-30T00:00:00.000Z',
  ...over,
});

describe('crediting', () => {
  it('spec acceptance: 3 weeks of weekly allowance, reload adds no duplicates', async () => {
    const sheets = new FakeSheets();
    const repo = createRepository(sheets);
    await createFamilySheet(sheets, fakeDrive, { familyName: 'F', defaultCurrency: 'ILS' });
    await repo.addKid('sheet-1', kid());

    let fam = await repo.loadFamily('sheet-1');
    expect(await creditAllowances(repo, fam, TODAY, 'p@x')).toBe(4); // Sunday start, Sunday today
    fam = await repo.loadFamily('sheet-1');
    expect(fam.balances.get('k1')).toBe(8000);
    expect(fam.transactions.map((t) => t.date)).toEqual([
      '2026-08-30',
      '2026-09-06',
      '2026-09-13',
      '2026-09-20',
    ]);

    expect(await creditAllowances(repo, fam, TODAY, 'p@x')).toBe(0);
    fam = await repo.loadFamily('sheet-1');
    expect(fam.transactions).toHaveLength(4);
  });

  it('skips archived kids, none frequency and zero amounts', () => {
    const base = {
      fileId: 'x',
      settings: { familyName: '', defaultCurrency: 'ILS' },
      transactions: [],
      goals: [],
      balances: new Map(),
      warnings: [],
    };
    expect(missingAllowances({ ...base, kids: [kid({ archived: true })] }, TODAY, 'p')).toEqual([]);
    expect(
      missingAllowances({ ...base, kids: [kid({ allowanceFrequency: 'none' })] }, TODAY, 'p'),
    ).toEqual([]);
    expect(missingAllowances({ ...base, kids: [kid({ allowanceAmount: 0 })] }, TODAY, 'p')).toEqual(
      [],
    );
    expect(missingAllowances({ ...base, kids: [kid()] }, TODAY, 'p')).toHaveLength(4);
  });

  it('uses the deterministic id so a manual duplicate is recognized', () => {
    const base = {
      fileId: 'x',
      settings: { familyName: '', defaultCurrency: 'ILS' },
      goals: [],
      balances: new Map(),
      warnings: [],
      kids: [kid()],
    };
    const existing = missingAllowances({ ...base, transactions: [] }, TODAY, 'p').slice(0, 2);
    expect(
      missingAllowances({ ...base, transactions: existing }, TODAY, 'p').map((t) => t.date),
    ).toEqual(['2026-09-13', '2026-09-20']);
  });
});

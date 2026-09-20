import { beforeEach, describe, expect, it } from 'vitest';
import { FakeSheets } from '../test/fakeSheets';
import { createRepository, type Repository } from './repository';
import { createFamilySheet } from './bootstrap';
import { encodeRow, transactionCodec, type Kid, type Transaction } from '../domain/schema';
import type { Drive } from '../google/drive';

const kid: Kid = {
  id: 'k1',
  name: 'Noa',
  avatar: '🦊',
  currency: 'ILS',
  allowanceAmount: 2000,
  allowanceFrequency: 'weekly',
  allowanceDay: 5,
  startDate: '2026-09-01',
  archived: false,
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const tx = (id: string, amount: number): Transaction => ({
  id,
  kidId: 'k1',
  date: '2026-09-20',
  amount,
  type: 'deposit',
  note: '',
  createdBy: 'p@x',
  createdAt: '2026-09-20T00:00:00.000Z',
});

const fakeDrive = { markAsAppFile: async () => ({ id: 'sheet-1', name: 'x' }) } as unknown as Drive;

describe('repository', () => {
  let sheets: FakeSheets;
  let repo: Repository;
  beforeEach(async () => {
    sheets = new FakeSheets();
    repo = createRepository(sheets);
    await createFamilySheet(sheets, fakeDrive, { familyName: 'Nevet', defaultCurrency: 'ILS' });
  });

  it('bootstraps headers, settings and protection', async () => {
    expect(sheets.tabs.get('kids')![0]).toContain('hash');
    expect(sheets.protectedSheetIds).toEqual([100, 200, 300]);
    const fam = await repo.loadFamily('sheet-1');
    expect(fam.settings).toEqual({ familyName: 'Nevet', defaultCurrency: 'ILS' });
    expect(fam.kids).toEqual([]);
    expect(fam.warnings).toEqual([]);
  });

  it('round-trips kids and transactions with balances', async () => {
    await repo.addKid('sheet-1', kid);
    await repo.appendTransactions('sheet-1', [tx('a', 1000), tx('b', -250)]);
    const fam = await repo.loadFamily('sheet-1');
    expect(fam.kids).toEqual([kid]);
    expect(fam.balances.get('k1')).toBe(750);
  });

  it('ignores a hand-edited row and reports it with its sheet row number', async () => {
    await repo.appendTransactions('sheet-1', [tx('a', 1000), tx('b', -250)]);
    sheets.tabs.get('transactions')![2]![3] = '-25.00'; // row 3 in Sheets
    const fam = await repo.loadFamily('sheet-1');
    expect(fam.balances.get('k1')).toBe(1000);
    expect(fam.warnings).toEqual([
      { tab: 'transactions', row: 3, reason: 'bad_hash', detail: 'mismatch' },
    ]);
  });

  it('ignores a hand-added row without a hash', async () => {
    sheets.tabs.get('transactions')!.push(transactionCodec.toFields(tx('manual', 99999)));
    const fam = await repo.loadFamily('sheet-1');
    expect(fam.transactions).toEqual([]);
    expect(fam.warnings[0]).toMatchObject({ reason: 'bad_hash', detail: 'missing' });
  });

  it('dedupes concurrent duplicate appends by id', async () => {
    await repo.appendTransactions('sheet-1', [tx('allowance:k1:2026-09-19', 2000)]);
    await repo.appendTransactions('sheet-1', [tx('allowance:k1:2026-09-19', 2000)]);
    const fam = await repo.loadFamily('sheet-1');
    expect(fam.transactions).toHaveLength(1);
    expect(fam.balances.get('k1')).toBe(2000);
  });

  it('updates a kid row in place and bumps updatedAt', async () => {
    await repo.addKid('sheet-1', kid);
    const next = await repo.updateKid('sheet-1', { ...kid, name: 'Noa B.' }, kid.updatedAt);
    expect(next.updatedAt).not.toBe(kid.updatedAt);
    const fam = await repo.loadFamily('sheet-1');
    expect(fam.kids).toEqual([next]);
    expect(sheets.tabs.get('kids')).toHaveLength(2);
  });

  it('refuses to overwrite a row someone else changed', async () => {
    await repo.addKid('sheet-1', kid);
    await repo.updateKid('sheet-1', { ...kid, name: 'other parent' }, kid.updatedAt);
    await expect(
      repo.updateKid('sheet-1', { ...kid, name: 'me' }, kid.updatedAt),
    ).rejects.toMatchObject({
      kind: 'conflict',
    });
  });

  it('fails clearly when headers are wrong', async () => {
    sheets.tabs.get('goals')![0] = ['id', 'nope'];
    await expect(repo.loadFamily('sheet-1')).rejects.toMatchObject({ kind: 'schema' });
  });

  it('skips blank lines and tolerates extra columns', async () => {
    const row = await encodeRow(transactionCodec, tx('a', 500));
    sheets.tabs.get('transactions')!.push([], [...row, 'parent comment']);
    const fam = await repo.loadFamily('sheet-1');
    expect(fam.transactions).toHaveLength(1);
    expect(fam.warnings).toEqual([]);
  });
});

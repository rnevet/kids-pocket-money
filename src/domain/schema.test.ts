import { describe, expect, it } from 'vitest';
import {
  decodeRow,
  encodeRow,
  goalCodec,
  headerRow,
  headersMatch,
  kidCodec,
  settingsFromRows,
  settingsToRows,
  transactionCodec,
  type Goal,
  type Kid,
  type Transaction,
} from './schema';

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
  updatedAt: '2026-09-20T10:00:00.000Z',
};
const tx: Transaction = {
  id: 't1',
  kidId: 'k1',
  date: '2026-09-20',
  amount: -1250,
  type: 'withdrawal',
  note: 'ice cream',
  createdBy: 'p@example.com',
  createdAt: '2026-09-20T10:00:00.000Z',
};
const goal: Goal = {
  id: 'g1',
  kidId: 'k1',
  name: 'Lego',
  price: 15000,
  status: 'active',
  createdAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
};

describe('codecs round-trip with hash', () => {
  it('kid', async () => {
    const row = await encodeRow(kidCodec, kid);
    expect(row).toHaveLength(headerRow(kidCodec).length);
    expect(await decodeRow(kidCodec, row)).toEqual({ ok: true, value: kid });
  });
  it('transaction', async () => {
    const row = await encodeRow(transactionCodec, tx);
    expect(await decodeRow(transactionCodec, row)).toEqual({ ok: true, value: tx });
  });
  it('goal', async () => {
    const row = await encodeRow(goalCodec, goal);
    expect(await decodeRow(goalCodec, row)).toEqual({ ok: true, value: goal });
  });
});

describe('decodeRow rejects', () => {
  it('a hand-edited amount', async () => {
    const row = await encodeRow(transactionCodec, tx);
    row[3] = '-120.50';
    const r = await decodeRow(transactionCodec, row);
    expect(r).toEqual({ ok: false, reason: 'bad_hash', detail: 'mismatch' });
  });
  it('a missing hash', async () => {
    const row = transactionCodec.toFields(tx);
    expect(await decodeRow(transactionCodec, row)).toMatchObject({
      ok: false,
      reason: 'bad_hash',
      detail: 'missing',
    });
  });
  it('an unparsable row before checking the hash', async () => {
    const row = await encodeRow(transactionCodec, tx);
    row[2] = 'yesterday';
    expect(await decodeRow(transactionCodec, row)).toEqual({
      ok: false,
      reason: 'invalid',
      detail: 'date',
    });
  });
  it('a missing kid field', () => {
    expect(
      kidCodec.fromFields([
        'k1',
        '',
        '🦊',
        'ILS',
        '1.00',
        'weekly',
        '1',
        '2026-01-01',
        'FALSE',
        kid.updatedAt,
      ]),
    ).toEqual({
      ok: false,
      reason: 'name',
    });
    expect(
      kidCodec.fromFields([
        'k1',
        'N',
        '',
        'ils',
        '1.00',
        'weekly',
        '1',
        '2026-01-01',
        'FALSE',
        kid.updatedAt,
      ]),
    ).toEqual({
      ok: false,
      reason: 'currency',
    });
    expect(
      kidCodec.fromFields([
        'k1',
        'N',
        '',
        'ILS',
        '1.00',
        'weekly',
        '7',
        '2026-01-01',
        'FALSE',
        kid.updatedAt,
      ]),
    ).toEqual({
      ok: false,
      reason: 'allowanceDay',
    });
  });
});

describe('formatting-only differences do not reject', () => {
  it('Sheets turning 12.50 into 12.5 and TRUE into true still verifies', async () => {
    const row = await encodeRow(kidCodec, { ...kid, allowanceAmount: 1250, archived: true });
    row[4] = '12.5';
    row[8] = 'true';
    row[1] = '  Noa ';
    expect(await decodeRow(kidCodec, row)).toMatchObject({ ok: true });
  });
  it('extra trailing columns are ignored', async () => {
    const row = [...(await encodeRow(transactionCodec, tx)), 'comment from a parent'];
    expect(await decodeRow(transactionCodec, row)).toEqual({ ok: true, value: tx });
  });
});

describe('settings', () => {
  it('round-trips and defaults', () => {
    const rows = settingsToRows({ familyName: 'Nevet', defaultCurrency: 'ILS' });
    expect(settingsFromRows(rows)).toEqual({ familyName: 'Nevet', defaultCurrency: 'ILS' });
    expect(settingsFromRows([])).toEqual({ familyName: '', defaultCurrency: 'USD' });
    expect(settingsFromRows([['defaultCurrency', 'nope']]).defaultCurrency).toBe('USD');
  });
});

describe('headersMatch', () => {
  it('tolerates extra columns but not missing ones', () => {
    expect(headersMatch(headerRow(goalCodec), [...headerRow(goalCodec), 'extra'])).toBe(true);
    expect(headersMatch(headerRow(goalCodec), headerRow(goalCodec).slice(0, -1))).toBe(false);
    expect(headersMatch(['id', 'kidId'], ['id ', 'kidId'])).toBe(true);
  });
});

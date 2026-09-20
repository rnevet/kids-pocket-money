import { formatAmountCell, parseAmount, type Minor } from './money';
import { isIsoDate, type IsoDate } from './dates';
import { isValidDay, type Frequency } from './allowance';
import { hashRow, verifyRow } from './rowhash';

export const SCHEMA_VERSION = '1';
export const APP_PROPERTY_KEY = 'pocketMoneyApp';

export const TABS = {
  settings: 'settings',
  kids: 'kids',
  transactions: 'transactions',
  goals: 'goals',
} as const;
export type TabName = (typeof TABS)[keyof typeof TABS];

export interface Settings {
  familyName: string;
  defaultCurrency: string;
}

export interface Kid {
  id: string;
  name: string;
  avatar: string;
  currency: string;
  allowanceAmount: Minor;
  allowanceFrequency: Frequency;
  allowanceDay: number;
  startDate: IsoDate;
  archived: boolean;
  updatedAt: string;
}

export const TX_TYPES = ['allowance', 'deposit', 'withdrawal', 'adjustment'] as const;
export type TxType = (typeof TX_TYPES)[number];

export interface Transaction {
  id: string;
  kidId: string;
  date: IsoDate;
  amount: Minor;
  type: TxType;
  note: string;
  createdBy: string;
  createdAt: string;
}

export const GOAL_STATUSES = ['active', 'done', 'deleted'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface Goal {
  id: string;
  kidId: string;
  name: string;
  price: Minor;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };
export type RowReject = 'invalid' | 'bad_hash';
export type DecodeResult<T> =
  { ok: true; value: T } | { ok: false; reason: RowReject; detail: string };

/** A codec maps an object to its normalized field list (without hash) and back. */
export interface TabCodec<T> {
  tab: TabName;
  /** Data headers, excluding the trailing `hash` column. */
  headers: readonly string[];
  toFields(value: T): string[];
  fromFields(fields: readonly string[]): ParseResult<T>;
}

export const HASH_HEADER = 'hash';

// ---- helpers ---------------------------------------------------------------

const cell = (fields: readonly string[], i: number): string => (fields[i] ?? '').trim();
const CURRENCY_RE = /^[A-Z]{3}$/;
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function parseBool(s: string): boolean | null {
  const v = s.trim().toUpperCase();
  if (v === 'TRUE' || v === '1' || v === 'YES') return true;
  if (v === 'FALSE' || v === '0' || v === 'NO' || v === '') return false;
  return null;
}
const boolCell = (b: boolean) => (b ? 'TRUE' : 'FALSE');

function oneOf<T extends string>(list: readonly T[], s: string): T | null {
  return (list as readonly string[]).includes(s) ? (s as T) : null;
}

function isTimestamp(s: string): boolean {
  return ISO_TS_RE.test(s) && !Number.isNaN(Date.parse(s));
}

export function nowTimestamp(now: Date = new Date()): string {
  return now.toISOString();
}

// ---- kids ------------------------------------------------------------------

export const kidCodec: TabCodec<Kid> = {
  tab: TABS.kids,
  headers: [
    'id',
    'name',
    'avatar',
    'currency',
    'allowanceAmount',
    'allowanceFrequency',
    'allowanceDay',
    'startDate',
    'archived',
    'updatedAt',
  ],
  toFields: (k) => [
    k.id,
    k.name.trim(),
    k.avatar.trim(),
    k.currency,
    formatAmountCell(k.allowanceAmount),
    k.allowanceFrequency,
    String(k.allowanceDay),
    k.startDate,
    boolCell(k.archived),
    k.updatedAt,
  ],
  fromFields: (f) => {
    const id = cell(f, 0);
    const name = cell(f, 1);
    const avatar = cell(f, 2);
    const currency = cell(f, 3);
    const allowanceAmount = parseAmount(cell(f, 4));
    const allowanceFrequency = oneOf<Frequency>(['none', 'weekly', 'monthly'], cell(f, 5));
    const allowanceDay = Number(cell(f, 6) || '0');
    const startDate = cell(f, 7);
    const archived = parseBool(cell(f, 8));
    const updatedAt = cell(f, 9);
    if (!id) return { ok: false, reason: 'id' };
    if (!name) return { ok: false, reason: 'name' };
    if (!CURRENCY_RE.test(currency)) return { ok: false, reason: 'currency' };
    if (allowanceAmount === null || allowanceAmount < 0)
      return { ok: false, reason: 'allowanceAmount' };
    if (!allowanceFrequency) return { ok: false, reason: 'allowanceFrequency' };
    if (!isValidDay(allowanceFrequency, allowanceDay)) return { ok: false, reason: 'allowanceDay' };
    if (!isIsoDate(startDate)) return { ok: false, reason: 'startDate' };
    if (archived === null) return { ok: false, reason: 'archived' };
    if (!isTimestamp(updatedAt)) return { ok: false, reason: 'updatedAt' };
    return {
      ok: true,
      value: {
        id,
        name,
        avatar,
        currency,
        allowanceAmount,
        allowanceFrequency,
        allowanceDay,
        startDate,
        archived,
        updatedAt,
      },
    };
  },
};

// ---- transactions ----------------------------------------------------------

export const transactionCodec: TabCodec<Transaction> = {
  tab: TABS.transactions,
  headers: ['id', 'kidId', 'date', 'amount', 'type', 'note', 'createdBy', 'createdAt'],
  toFields: (t) => [
    t.id,
    t.kidId,
    t.date,
    formatAmountCell(t.amount),
    t.type,
    t.note.trim(),
    t.createdBy.trim(),
    t.createdAt,
  ],
  fromFields: (f) => {
    const id = cell(f, 0);
    const kidId = cell(f, 1);
    const date = cell(f, 2);
    const amount = parseAmount(cell(f, 3));
    const type = oneOf(TX_TYPES, cell(f, 4));
    const note = cell(f, 5);
    const createdBy = cell(f, 6);
    const createdAt = cell(f, 7);
    if (!id) return { ok: false, reason: 'id' };
    if (!kidId) return { ok: false, reason: 'kidId' };
    if (!isIsoDate(date)) return { ok: false, reason: 'date' };
    if (amount === null) return { ok: false, reason: 'amount' };
    if (!type) return { ok: false, reason: 'type' };
    if (!isTimestamp(createdAt)) return { ok: false, reason: 'createdAt' };
    return { ok: true, value: { id, kidId, date, amount, type, note, createdBy, createdAt } };
  },
};

// ---- goals -----------------------------------------------------------------

export const goalCodec: TabCodec<Goal> = {
  tab: TABS.goals,
  headers: ['id', 'kidId', 'name', 'price', 'status', 'createdAt', 'updatedAt'],
  toFields: (g) => [
    g.id,
    g.kidId,
    g.name.trim(),
    formatAmountCell(g.price),
    g.status,
    g.createdAt,
    g.updatedAt,
  ],
  fromFields: (f) => {
    const id = cell(f, 0);
    const kidId = cell(f, 1);
    const name = cell(f, 2);
    const price = parseAmount(cell(f, 3));
    const status = oneOf(GOAL_STATUSES, cell(f, 4));
    const createdAt = cell(f, 5);
    const updatedAt = cell(f, 6);
    if (!id) return { ok: false, reason: 'id' };
    if (!kidId) return { ok: false, reason: 'kidId' };
    if (!name) return { ok: false, reason: 'name' };
    if (price === null || price <= 0) return { ok: false, reason: 'price' };
    if (!status) return { ok: false, reason: 'status' };
    if (!isTimestamp(createdAt)) return { ok: false, reason: 'createdAt' };
    if (!isTimestamp(updatedAt)) return { ok: false, reason: 'updatedAt' };
    return { ok: true, value: { id, kidId, name, price, status, createdAt, updatedAt } };
  },
};

// ---- settings (key/value, no hash) ----------------------------------------

export const SETTINGS_HEADERS = ['key', 'value'] as const;

export function settingsToRows(s: Settings): string[][] {
  return [
    ['familyName', s.familyName.trim()],
    ['defaultCurrency', s.defaultCurrency],
  ];
}

export function settingsFromRows(rows: readonly (readonly string[])[]): Settings {
  const map = new Map<string, string>();
  for (const r of rows) {
    const k = cell(r, 0);
    if (k) map.set(k, cell(r, 1));
  }
  const currency = map.get('defaultCurrency') ?? '';
  return {
    familyName: map.get('familyName') ?? '',
    defaultCurrency: CURRENCY_RE.test(currency) ? currency : 'USD',
  };
}

// ---- row encode / decode with hash ----------------------------------------

export function headerRow<T>(codec: TabCodec<T>): string[] {
  return [...codec.headers, HASH_HEADER];
}

/** Full sheet row: normalized fields followed by the hash. */
export async function encodeRow<T>(codec: TabCodec<T>, value: T): Promise<string[]> {
  const fields = codec.toFields(value);
  return [...fields, await hashRow(fields)];
}

/**
 * Parse then verify. The hash is computed over the normalized re-encoded
 * fields, so formatting-only differences (12.5 vs 12.50) do not reject rows.
 */
export async function decodeRow<T>(
  codec: TabCodec<T>,
  row: readonly string[],
): Promise<DecodeResult<T>> {
  const parsed = codec.fromFields(row);
  if (!parsed.ok) return { ok: false, reason: 'invalid', detail: parsed.reason };
  const hash = cell(row, codec.headers.length);
  const valid = await verifyRow(codec.toFields(parsed.value), hash);
  if (!valid) return { ok: false, reason: 'bad_hash', detail: hash ? 'mismatch' : 'missing' };
  return { ok: true, value: parsed.value };
}

/** Check that a tab's first row starts with the expected headers (extra columns are tolerated). */
export function headersMatch(expected: readonly string[], actual: readonly string[]): boolean {
  return expected.every((h, i) => (actual[i] ?? '').trim() === h);
}

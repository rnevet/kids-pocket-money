import { balances, dedupeById } from '../domain/balance';
import type { Minor } from '../domain/money';
import {
  SETTINGS_HEADERS,
  TABS,
  decodeRow,
  encodeRow,
  goalCodec,
  headerRow,
  headersMatch,
  kidCodec,
  nowTimestamp,
  settingsFromRows,
  settingsToRows,
  transactionCodec,
  type Goal,
  type Kid,
  type RowReject,
  type Settings,
  type TabCodec,
  type TabName,
  type Transaction,
} from '../domain/schema';
import { AppError } from '../google/errors';
import { a1, type Rows, type Sheets } from '../google/sheets';

export interface RowWarning {
  tab: TabName;
  /** 1-based row number as shown in Google Sheets. */
  row: number;
  reason: RowReject;
  detail: string;
}

export interface Family {
  fileId: string;
  settings: Settings;
  kids: Kid[];
  transactions: Transaction[];
  goals: Goal[];
  balances: Map<string, Minor>;
  warnings: RowWarning[];
}

const DATA_RANGE = 'A:Z';

async function decodeTab<T>(
  codec: TabCodec<T>,
  rows: Rows,
): Promise<{ values: T[]; warnings: RowWarning[] }> {
  const [header = [], ...body] = rows;
  if (!headersMatch(headerRow(codec), header)) {
    throw new AppError('schema', `Tab "${codec.tab}" has unexpected headers`);
  }
  const values: T[] = [];
  const warnings: RowWarning[] = [];
  for (let i = 0; i < body.length; i++) {
    const row = body[i]!;
    if (row.every((c) => c.trim() === '')) continue; // blank line
    const r = await decodeRow(codec, row);
    if (r.ok) values.push(r.value);
    else warnings.push({ tab: codec.tab, row: i + 2, reason: r.reason, detail: r.detail });
  }
  return { values, warnings };
}

export function createRepository(sheets: Sheets) {
  async function findRow<T extends { id: string }>(
    fileId: string,
    codec: TabCodec<T>,
    id: string,
  ): Promise<{ rowNumber: number; current: T | null }> {
    const [rows = []] = await sheets.batchGet(fileId, [a1(codec.tab, DATA_RANGE)]);
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i]?.[0] ?? '').trim() === id) {
        const r = await decodeRow(codec, rows[i]!);
        return { rowNumber: i + 1, current: r.ok ? r.value : null };
      }
    }
    throw new AppError('not_found', `Row ${id} not found in ${codec.tab}`);
  }

  /**
   * Replace one row. Aborts with `conflict` when the row's updatedAt changed
   * since the caller loaded it (another parent edited it). The window between
   * the read and the write cannot be closed with the Sheets API.
   */
  async function updateRow<T extends { id: string; updatedAt: string }>(
    fileId: string,
    codec: TabCodec<T>,
    value: T,
    expectedUpdatedAt: string,
  ): Promise<T> {
    const { rowNumber, current } = await findRow(fileId, codec, value.id);
    if (current && current.updatedAt !== expectedUpdatedAt) {
      throw new AppError('conflict', `${codec.tab} row ${value.id} was changed by someone else`);
    }
    const next = { ...value, updatedAt: nowTimestamp() };
    const row = await encodeRow(codec, next);
    const lastCol = String.fromCharCode(64 + row.length);
    await sheets.update(fileId, a1(codec.tab, `A${rowNumber}:${lastCol}${rowNumber}`), [row]);
    return next;
  }

  async function appendRows<T>(fileId: string, codec: TabCodec<T>, values: T[]): Promise<void> {
    if (values.length === 0) return;
    const rows = await Promise.all(values.map((v) => encodeRow(codec, v)));
    await sheets.append(fileId, a1(codec.tab, DATA_RANGE), rows);
  }

  return {
    async loadFamily(fileId: string): Promise<Family> {
      const [settingsRows = [], kidRows = [], txRows = [], goalRows = []] = await sheets.batchGet(
        fileId,
        [
          a1(TABS.settings, DATA_RANGE),
          a1(TABS.kids, DATA_RANGE),
          a1(TABS.transactions, DATA_RANGE),
          a1(TABS.goals, DATA_RANGE),
        ],
      );
      if (!headersMatch(SETTINGS_HEADERS, settingsRows[0] ?? [])) {
        throw new AppError('schema', 'Tab "settings" has unexpected headers');
      }
      const kids = await decodeTab(kidCodec, kidRows);
      const txs = await decodeTab(transactionCodec, txRows);
      const goals = await decodeTab(goalCodec, goalRows);
      const transactions = dedupeById(txs.values);
      return {
        fileId,
        settings: settingsFromRows(settingsRows.slice(1)),
        kids: kids.values,
        transactions,
        goals: goals.values,
        balances: balances(transactions),
        warnings: [...kids.warnings, ...txs.warnings, ...goals.warnings],
      };
    },

    appendTransactions: (fileId: string, txs: Transaction[]) =>
      appendRows(fileId, transactionCodec, txs),
    addKid: (fileId: string, kid: Kid) => appendRows(fileId, kidCodec, [kid]),
    addGoal: (fileId: string, goal: Goal) => appendRows(fileId, goalCodec, [goal]),
    updateKid: (fileId: string, kid: Kid, expectedUpdatedAt: string) =>
      updateRow(fileId, kidCodec, kid, expectedUpdatedAt),
    updateGoal: (fileId: string, goal: Goal, expectedUpdatedAt: string) =>
      updateRow(fileId, goalCodec, goal, expectedUpdatedAt),

    async updateSettings(fileId: string, settings: Settings): Promise<void> {
      const rows = settingsToRows(settings);
      await sheets.update(fileId, a1(TABS.settings, `A2:B${rows.length + 1}`), rows);
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;

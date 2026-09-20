import type { Rows, Sheets, SpreadsheetInfo } from '../google/sheets';

/** In-memory Sheets API good enough for the ranges this app uses. */
export class FakeSheets implements Sheets {
  tabs = new Map<string, Rows>();
  protectedSheetIds: number[] = [];
  calls: string[] = [];

  private parse(range: string): { tab: string; startRow: number; endRow: number | null } {
    const m = /^'((?:[^']|'')*)'(?:!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?)?$/.exec(range);
    if (!m) throw new Error(`unsupported range ${range}`);
    return {
      tab: m[1]!.replace(/''/g, "'"),
      startRow: m[3] ? Number(m[3]) : 1,
      endRow: m[5] ? Number(m[5]) : m[3] && !m[4] ? Number(m[3]) : null,
    };
  }

  private rows(tab: string): Rows {
    const r = this.tabs.get(tab);
    if (!r) throw Object.assign(new Error(`no tab ${tab}`), { kind: 'not_found' });
    return r;
  }

  async create(title: string, tabTitles: string[]): Promise<SpreadsheetInfo> {
    this.calls.push(`create ${title}`);
    for (const t of tabTitles) this.tabs.set(t, []);
    return {
      spreadsheetId: 'sheet-1',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-1',
      sheets: tabTitles.map((t, i) => ({ properties: { sheetId: i * 100, title: t } })),
    };
  }

  async getInfo(): Promise<SpreadsheetInfo> {
    return {
      spreadsheetId: 'sheet-1',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-1',
      sheets: [...this.tabs.keys()].map((t, i) => ({ properties: { sheetId: i * 100, title: t } })),
    };
  }

  async batchGet(_id: string, ranges: string[]): Promise<Rows[]> {
    this.calls.push(`batchGet ${ranges.length}`);
    return ranges.map((r) => {
      const { tab, startRow, endRow } = this.parse(r);
      const rows = this.rows(tab);
      // Sheets trims trailing empty cells and rows.
      return rows
        .slice(startRow - 1, endRow ?? undefined)
        .map((row) => row.map((c) => String(c)))
        .map((row) => {
          const out = [...row];
          while (out.length && out[out.length - 1] === '') out.pop();
          return out;
        });
    });
  }

  async append(_id: string, range: string, rows: Rows) {
    this.calls.push(`append ${rows.length}`);
    const { tab } = this.parse(range);
    this.rows(tab).push(...rows.map((r) => [...r]));
    return {};
  }

  async update(_id: string, range: string, rows: Rows) {
    this.calls.push(`update ${range}`);
    const { tab, startRow } = this.parse(range);
    const target = this.rows(tab);
    rows.forEach((r, i) => {
      target[startRow - 1 + i] = [...r];
    });
    return {};
  }

  async batchUpdateValues(id: string, data: { range: string; values: Rows }[]) {
    for (const d of data) await this.update(id, d.range, d.values);
    return {};
  }

  async protectTabs(_id: string, sheetIds: number[]) {
    this.protectedSheetIds.push(...sheetIds);
    return {};
  }
}

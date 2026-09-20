import { jsonInit, qs, type Http } from './http';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export type Rows = string[][];

export interface ValueRange {
  range: string;
  values?: Rows;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheets: { properties: { sheetId: number; title: string } }[];
}

/** Quote a tab name for A1 notation. */
export function a1(tab: string, range?: string): string {
  const t = `'${tab.replace(/'/g, "''")}'`;
  return range ? `${t}!${range}` : t;
}

export function createSheets(http: Http) {
  const id = (s: string) => encodeURIComponent(s);
  return {
    create: (title: string, tabTitles: string[]) =>
      http.request<SpreadsheetInfo>(
        BASE,
        jsonInit('POST', {
          properties: { title },
          sheets: tabTitles.map((t) => ({ properties: { title: t } })),
        }),
      ),

    getInfo: (spreadsheetId: string) =>
      http.request<SpreadsheetInfo>(
        `${BASE}/${id(spreadsheetId)}${qs({ fields: 'spreadsheetId,spreadsheetUrl,sheets.properties(sheetId,title)' })}`,
      ),

    /** One round trip for all tabs. Returns ranges in request order. */
    batchGet: (spreadsheetId: string, ranges: string[]) => {
      const p = new URLSearchParams();
      for (const r of ranges) p.append('ranges', r);
      p.set('valueRenderOption', 'FORMATTED_VALUE');
      p.set('majorDimension', 'ROWS');
      return http
        .request<{ valueRanges?: ValueRange[] }>(
          `${BASE}/${id(spreadsheetId)}/values:batchGet?${p}`,
        )
        .then((r) => (r.valueRanges ?? []).map((v) => v.values ?? []));
    },

    append: (spreadsheetId: string, range: string, rows: Rows) =>
      http.request<{ updates?: { updatedRange?: string } }>(
        `${BASE}/${id(spreadsheetId)}/values/${encodeURIComponent(range)}:append${qs({
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
        })}`,
        jsonInit('POST', { values: rows, majorDimension: 'ROWS' }),
      ),

    update: (spreadsheetId: string, range: string, rows: Rows) =>
      http.request<unknown>(
        `${BASE}/${id(spreadsheetId)}/values/${encodeURIComponent(range)}${qs({ valueInputOption: 'RAW' })}`,
        jsonInit('PUT', { values: rows, majorDimension: 'ROWS' }),
      ),

    batchUpdateValues: (spreadsheetId: string, data: { range: string; values: Rows }[]) =>
      http.request<unknown>(
        `${BASE}/${id(spreadsheetId)}/values:batchUpdate`,
        jsonInit('POST', {
          valueInputOption: 'RAW',
          data: data.map((d) => ({ ...d, majorDimension: 'ROWS' })),
        }),
      ),

    /** Warning-only protection on whole tabs: Sheets shows a dialog before manual edits. */
    protectTabs: (spreadsheetId: string, sheetIds: number[]) =>
      http.request<unknown>(
        `${BASE}/${id(spreadsheetId)}:batchUpdate`,
        jsonInit('POST', {
          requests: sheetIds.map((sheetId) => ({
            addProtectedRange: {
              protectedRange: {
                range: { sheetId },
                description:
                  'Managed by the Pocket Money app. Manual edits are ignored by the app.',
                warningOnly: true,
              },
            },
          })),
        }),
      ),
  };
}

export type Sheets = ReturnType<typeof createSheets>;

import {
  SETTINGS_HEADERS,
  TABS,
  goalCodec,
  headerRow,
  kidCodec,
  settingsToRows,
  transactionCodec,
  type Settings,
} from '../domain/schema';
import type { Drive, DriveFile } from '../google/drive';
import { AppError } from '../google/errors';
import { a1, type Sheets } from '../google/sheets';

const STORAGE_KEY = 'pm.fileId';

export const fileIdStore = {
  get(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set(id: string | null) {
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode */
    }
  },
};

export function sheetTitle(familyName: string): string {
  return `Pocket Money - ${familyName.trim()}`;
}

/** Create the family sheet with all tabs, headers, settings, protection and Drive marker. */
export async function createFamilySheet(
  sheets: Sheets,
  drive: Drive,
  settings: Settings,
): Promise<string> {
  const tabs = [TABS.settings, TABS.kids, TABS.transactions, TABS.goals];
  const info = await sheets.create(sheetTitle(settings.familyName), tabs);
  const id = info.spreadsheetId;
  await sheets.batchUpdateValues(id, [
    {
      range: a1(TABS.settings, 'A1'),
      values: [[...SETTINGS_HEADERS], ...settingsToRows(settings)],
    },
    { range: a1(TABS.kids, 'A1'), values: [headerRow(kidCodec)] },
    { range: a1(TABS.transactions, 'A1'), values: [headerRow(transactionCodec)] },
    { range: a1(TABS.goals, 'A1'), values: [headerRow(goalCodec)] },
  ]);
  const dataSheetIds = info.sheets
    .filter((s) => s.properties.title !== TABS.settings)
    .map((s) => s.properties.sheetId);
  await sheets.protectTabs(id, dataSheetIds);
  await drive.markAsAppFile(id);
  return id;
}

export type Resolution =
  { kind: 'found'; file: DriveFile } | { kind: 'choose'; files: DriveFile[] } | { kind: 'none' };

/** Find the family sheet: cached id first, then Drive search by appProperties. */
export async function resolveFamilyFile(drive: Drive): Promise<Resolution> {
  const cached = fileIdStore.get();
  if (cached) {
    try {
      return { kind: 'found', file: await drive.getFile(cached) };
    } catch (e) {
      if (e instanceof AppError && (e.kind === 'not_found' || e.kind === 'permission')) {
        fileIdStore.set(null);
      } else {
        throw e;
      }
    }
  }
  const files = await drive.listAppFiles();
  if (files.length === 1) return { kind: 'found', file: files[0]! };
  if (files.length > 1) return { kind: 'choose', files };
  return { kind: 'none' };
}

export type Role = 'parent' | 'viewer';

export function roleOf(file: DriveFile): Role {
  return file.capabilities?.canEdit ? 'parent' : 'viewer';
}

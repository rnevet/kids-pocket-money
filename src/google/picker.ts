import { loadScript } from './auth';
import { AppError } from './errors';

declare global {
  // Minimal typing for the gapi loader that ships the Picker.
  const gapi: { load(name: 'picker', cb: () => void): void };
}

let pickerLoading: Promise<void> | undefined;

export function loadPicker(): Promise<void> {
  pickerLoading ??= loadScript('https://apis.google.com/js/api.js').then(
    () => new Promise<void>((r) => gapi.load('picker', r)),
  );
  return pickerLoading;
}

export interface PickerOptions {
  token: string;
  apiKey: string;
  appId: string;
  locale: string;
  /** Preselect a specific file (join flow). */
  fileId?: string;
}

/** Resolves to the picked spreadsheet id, or null when the user cancels. */
export async function pickSpreadsheet(o: PickerOptions): Promise<string | null> {
  await loadPicker();
  return new Promise((resolve, reject) => {
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS);
    view.setMode(google.picker.DocsViewMode.LIST);
    if (o.fileId) view.setFileIds(o.fileId);
    try {
      new google.picker.PickerBuilder()
        .setOAuthToken(o.token)
        .setDeveloperKey(o.apiKey)
        .setAppId(o.appId)
        .setLocale(o.locale as google.picker.Locales)
        .addView(view)
        .setCallback((data) => {
          const action = data[google.picker.Response.ACTION];
          if (action === google.picker.Action.PICKED) {
            const doc = data[google.picker.Response.DOCUMENTS]?.[0];
            resolve(doc?.[google.picker.Document.ID] ?? null);
          } else if (action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build()
        .setVisible(true);
    } catch (e) {
      reject(new AppError('unknown', 'Could not open Google Picker', undefined, { cause: e }));
    }
  });
}

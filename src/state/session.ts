import type { Family } from '../data/repository';
import type { Role } from '../data/bootstrap';
import type { DriveFile, DriveUser } from '../google/drive';
import type { AppError } from '../google/errors';

export type Session =
  | { status: 'booting' }
  | { status: 'signed_out'; reason?: 'expired' }
  | { status: 'resolving'; user: DriveUser }
  | { status: 'no_family'; user: DriveUser; joinFileId: string | null }
  | { status: 'choose'; user: DriveUser; files: DriveFile[] }
  | { status: 'ready'; user: DriveUser; file: DriveFile; role: Role; family: Family }
  | { status: 'error'; user: DriveUser | null; error: AppError };

export function sheetUrl(fileId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(fileId)}`;
}

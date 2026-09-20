import { APP_PROPERTY_KEY, SCHEMA_VERSION } from '../domain/schema';
import { jsonInit, qs, type Http } from './http';

const BASE = 'https://www.googleapis.com/drive/v3';

export interface DriveFile {
  id: string;
  name: string;
  capabilities?: { canEdit?: boolean; canShare?: boolean };
  appProperties?: Record<string, string>;
  modifiedTime?: string;
}

export interface DriveUser {
  emailAddress: string;
  displayName?: string;
}

export interface Permission {
  id: string;
  type: string;
  role: 'owner' | 'writer' | 'reader' | 'commenter' | string;
  emailAddress?: string;
  displayName?: string;
}

export type ShareRole = 'writer' | 'reader';

const FILE_FIELDS = 'id,name,capabilities(canEdit,canShare),appProperties,modifiedTime';

export function createDrive(http: Http) {
  return {
    about: () =>
      http.request<{ user: DriveUser }>(
        `${BASE}/about${qs({ fields: 'user(emailAddress,displayName)' })}`,
      ),

    getFile: (id: string) =>
      http.request<DriveFile>(
        `${BASE}/files/${encodeURIComponent(id)}${qs({ fields: FILE_FIELDS })}`,
      ),

    listAppFiles: () =>
      http
        .request<{ files: DriveFile[] }>(
          `${BASE}/files${qs({
            q: `appProperties has { key='${APP_PROPERTY_KEY}' and value='1' } and trashed=false`,
            fields: `files(${FILE_FIELDS})`,
            orderBy: 'modifiedTime desc',
            pageSize: 20,
          })}`,
        )
        .then((r) => r.files ?? []),

    markAsAppFile: (id: string) =>
      http.request<DriveFile>(
        `${BASE}/files/${encodeURIComponent(id)}${qs({ fields: FILE_FIELDS })}`,
        jsonInit('PATCH', {
          appProperties: { [APP_PROPERTY_KEY]: '1', schemaVersion: SCHEMA_VERSION },
        }),
      ),

    listPermissions: (fileId: string) =>
      http
        .request<{ permissions: Permission[] }>(
          `${BASE}/files/${encodeURIComponent(fileId)}/permissions${qs({
            fields: 'permissions(id,type,role,emailAddress,displayName)',
          })}`,
        )
        .then((r) => r.permissions ?? []),

    createPermission: (fileId: string, email: string, role: ShareRole, emailMessage: string) =>
      http.request<Permission>(
        `${BASE}/files/${encodeURIComponent(fileId)}/permissions${qs({
          sendNotificationEmail: true,
          emailMessage,
          fields: 'id,type,role,emailAddress',
        })}`,
        jsonInit('POST', { type: 'user', role, emailAddress: email }),
      ),

    deletePermission: (fileId: string, permissionId: string) =>
      http.request<void>(
        `${BASE}/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}`,
        { method: 'DELETE' },
      ),
  };
}

export type Drive = ReturnType<typeof createDrive>;

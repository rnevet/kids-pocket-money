import { vi } from 'vitest';
import { createRepository } from '../data/repository';
import type { AuthClient } from '../google/auth';
import type { Drive, DriveFile, Permission } from '../google/drive';
import type { Services } from '../state/services';
import { FakeSheets } from './fakeSheets';

export function fakeServices(opts: { canEdit?: boolean; email?: string; signedIn?: boolean } = {}) {
  const sheets = new FakeSheets();
  const files = new Map<string, DriveFile>();
  const permissions: Permission[] = [
    {
      id: 'p-owner',
      type: 'user',
      role: 'owner',
      emailAddress: opts.email ?? 'parent@example.com',
    },
  ];
  let signedIn = opts.signedIn ?? false;
  let hint: string | null = opts.signedIn ? (opts.email ?? 'parent@example.com') : null;

  const auth: AuthClient = {
    getToken: () => (signedIn ? 'token' : null),
    refreshSilently: async () => (signedIn ? 'token' : null),
    isSignedIn: () => signedIn,
    hasSession: () => hint !== null,
    remember: (email) => {
      hint = email;
    },
    signIn: async () => {
      signedIn = true;
      return 'token';
    },
    signOut: async () => {
      signedIn = false;
      hint = null;
    },
  };

  const drive = {
    about: vi.fn(async () => ({ user: { emailAddress: opts.email ?? 'parent@example.com' } })),
    getFile: vi.fn(async (id: string) => {
      const f = files.get(id);
      if (!f) throw Object.assign(new Error('nf'), { kind: 'not_found' });
      return f;
    }),
    listAppFiles: vi.fn(async () => [...files.values()]),
    markAsAppFile: vi.fn(async (id: string) => {
      const f: DriveFile = {
        id,
        name: 'Pocket Money',
        capabilities: { canEdit: opts.canEdit ?? true, canShare: opts.canEdit ?? true },
      };
      files.set(id, f);
      return f;
    }),
    listPermissions: vi.fn(async () => permissions),
    createPermission: vi.fn(async (_f: string, email: string, role: string) => {
      const p: Permission = { id: `p-${email}`, type: 'user', role, emailAddress: email };
      permissions.push(p);
      return p;
    }),
    deletePermission: vi.fn(async () => undefined),
  } as unknown as Drive;

  const services: Services = {
    config: { clientId: 'c', apiKey: 'k', appId: 'a', appUrl: 'https://app.test/' },
    auth,
    drive,
    sheets,
    repo: createRepository(sheets),
  };
  return { services, sheets, files, drive };
}

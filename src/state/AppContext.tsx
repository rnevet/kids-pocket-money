import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createFamilySheet, fileIdStore, resolveFamilyFile, roleOf } from '../data/bootstrap';
import { creditAllowances, missingAllowances } from '../data/crediting';
import type { Family } from '../data/repository';
import { todayIso } from '../domain/dates';
import type { Minor } from '../domain/money';
import {
  nowTimestamp,
  type Goal,
  type Kid,
  type Settings,
  type Transaction,
  type TxType,
} from '../domain/schema';
import type { DriveFile, DriveUser, Permission, ShareRole } from '../google/drive';
import { AppError, toAppError } from '../google/errors';
import { pickSpreadsheet } from '../google/picker';
import i18n from '../i18n';
import type { Services } from './services';
import type { Session } from './session';

export type KidInput = Omit<Kid, 'id' | 'updatedAt'>;

export interface AppActions {
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  createFamily(settings: Settings, firstKid: KidInput): Promise<void>;
  openExisting(fileId?: string): Promise<void>;
  chooseFile(file: DriveFile): Promise<void>;
  switchFamily(): void;
  addTransaction(
    kidId: string,
    amount: Minor,
    type: TxType,
    note: string,
    date: string,
  ): Promise<void>;
  addKid(input: KidInput): Promise<Kid>;
  updateKid(kid: Kid, expectedUpdatedAt: string): Promise<void>;
  addGoal(kidId: string, name: string, price: Minor): Promise<void>;
  updateGoal(goal: Goal, expectedUpdatedAt: string): Promise<void>;
  updateSettings(settings: Settings): Promise<void>;
  listMembers(): Promise<Permission[]>;
  inviteLink(): string;
  invite(email: string, role: ShareRole): Promise<void>;
  removeMember(permissionId: string): Promise<void>;
}

export interface AppState {
  session: Session;
  busy: boolean;
  actions: AppActions;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** Convenience for screens that only render when a family is loaded. */
export function useFamily() {
  const { session, actions, busy } = useApp();
  if (session.status !== 'ready') throw new Error('useFamily outside ready session');
  return { ...session, actions, busy, isParent: session.role === 'parent' };
}

const CREDIT_DELAY_MS = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function joinIdFromUrl(): string | null {
  const id = new URLSearchParams(location.search).get('join');
  return id && /^[\w-]+$/.test(id) ? id : null;
}

function clearJoinFromUrl() {
  const url = new URL(location.href);
  if (url.searchParams.has('join')) {
    url.searchParams.delete('join');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
}

export function AppProvider({ services, children }: { services: Services; children: ReactNode }) {
  const { auth, drive, repo, sheets, config } = services;
  const [session, setSession] = useState<Session>({ status: 'booting' });
  const [busy, setBusy] = useState(false);
  const userRef = useRef<DriveUser | null>(null);
  const fileRef = useRef<DriveFile | null>(null);

  const fail = useCallback((e: unknown) => {
    const err = toAppError(e);
    if (err.kind === 'auth') {
      userRef.current = null;
      fileRef.current = null;
      setSession({ status: 'signed_out', reason: 'expired' });
    } else {
      setSession({ status: 'error', user: userRef.current, error: err });
    }
    return err;
  }, []);

  /** Load a family sheet and, for parents, credit due allowances. */
  const loadFile = useCallback(
    async (file: DriveFile) => {
      const user = userRef.current;
      if (!user) throw new AppError('auth', 'Not signed in');
      fileRef.current = file;
      fileIdStore.set(file.id);
      const role = roleOf(file);
      let family: Family = await repo.loadFamily(file.id);
      setSession({ status: 'ready', user, file, role, family });

      if (
        role === 'parent' &&
        missingAllowances(family, todayIso(), user.emailAddress).length > 0
      ) {
        // Shrinks (does not close) the window in which two parents credit at once.
        await sleep(CREDIT_DELAY_MS);
        family = await repo.loadFamily(file.id);
        const n = await creditAllowances(repo, family, todayIso(), user.emailAddress);
        if (n > 0) family = await repo.loadFamily(file.id);
        setSession({ status: 'ready', user, file, role, family });
      }
    },
    [repo],
  );

  const resolve = useCallback(async () => {
    const user = userRef.current;
    if (!user) return;
    setSession({ status: 'resolving', user });
    const joinFileId = joinIdFromUrl();
    if (joinFileId) {
      setSession({ status: 'no_family', user, joinFileId });
      return;
    }
    const r = await resolveFamilyFile(drive);
    if (r.kind === 'found') await loadFile(r.file);
    else if (r.kind === 'choose') setSession({ status: 'choose', user, files: r.files });
    else setSession({ status: 'no_family', user, joinFileId: null });
  }, [drive, loadFile]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      setBusy(true);
      try {
        return await fn();
      } catch (e) {
        throw fail(e);
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  /** Actions on a loaded family. Errors are thrown to the caller; auth errors also sign out. */
  const mutate = useCallback(
    async (fn: (family: Family, user: DriveUser) => Promise<void>) => {
      const file = fileRef.current;
      const user = userRef.current;
      if (!file || !user) throw new AppError('auth', 'Not signed in');
      setBusy(true);
      try {
        const family = await repo.loadFamily(file.id);
        await fn(family, user);
        await loadFile(file);
      } catch (e) {
        const err = toAppError(e);
        if (err.kind === 'auth') fail(err);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [repo, loadFile, fail],
  );

  const actions = useMemo<AppActions>(
    () => ({
      signIn: () =>
        run(async () => {
          await auth.signIn();
          const { user } = await drive.about();
          userRef.current = user;
          auth.remember(user.emailAddress);
          await resolve();
        }),

      signOut: async () => {
        await auth.signOut();
        userRef.current = null;
        fileRef.current = null;
        setSession({ status: 'signed_out' });
      },

      refresh: () =>
        run(async () => {
          if (fileRef.current) await loadFile(await drive.getFile(fileRef.current.id));
          else await resolve();
        }),

      createFamily: (settings, firstKid) =>
        run(async () => {
          const id = await createFamilySheet(sheets, drive, settings);
          const kid: Kid = { ...firstKid, id: crypto.randomUUID(), updatedAt: nowTimestamp() };
          await repo.addKid(id, kid);
          await loadFile(await drive.getFile(id));
        }),

      openExisting: (fileId) =>
        run(async () => {
          const token = auth.getToken() ?? (await auth.refreshSilently());
          if (!token) throw new AppError('auth', 'Not signed in');
          const picked = await pickSpreadsheet({
            token,
            apiKey: config.apiKey,
            appId: config.appId,
            locale: i18n.language,
            ...(fileId ? { fileId } : {}),
          });
          if (!picked) return;
          clearJoinFromUrl();
          await loadFile(await drive.getFile(picked));
        }),

      chooseFile: (file) => run(() => loadFile(file)),

      switchFamily: () => {
        fileIdStore.set(null);
        fileRef.current = null;
        void run(resolve);
      },

      addTransaction: (kidId, amount, type, note, date) =>
        mutate(async (family, user) => {
          const tx: Transaction = {
            id: crypto.randomUUID(),
            kidId,
            date,
            amount,
            type,
            note,
            createdBy: user.emailAddress,
            createdAt: nowTimestamp(),
          };
          await repo.appendTransactions(family.fileId, [tx]);
        }),

      addKid: async (input) => {
        const kid: Kid = { ...input, id: crypto.randomUUID(), updatedAt: nowTimestamp() };
        await mutate((family) => repo.addKid(family.fileId, kid));
        return kid;
      },

      updateKid: (kid, expected) =>
        mutate(async (family) => {
          await repo.updateKid(family.fileId, kid, expected);
        }),

      addGoal: (kidId, name, price) =>
        mutate(async (family) => {
          const now = nowTimestamp();
          const goal: Goal = {
            id: crypto.randomUUID(),
            kidId,
            name,
            price,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          };
          await repo.addGoal(family.fileId, goal);
        }),

      updateGoal: (goal, expected) =>
        mutate(async (family) => {
          await repo.updateGoal(family.fileId, goal, expected);
        }),

      updateSettings: (settings) =>
        mutate((family) => repo.updateSettings(family.fileId, settings)),

      listMembers: async () => {
        const file = fileRef.current;
        if (!file) return [];
        return drive.listPermissions(file.id);
      },

      inviteLink: () => {
        const file = fileRef.current;
        return file ? `${config.appUrl}?join=${encodeURIComponent(file.id)}` : '';
      },

      invite: async (email, role) => {
        const file = fileRef.current;
        if (!file) throw new AppError('not_found', 'No family');
        const url = `${config.appUrl}?join=${encodeURIComponent(file.id)}`;
        await drive.createPermission(
          file.id,
          email,
          role,
          i18n.t('settings.inviteMessage', { url }),
        );
      },

      removeMember: async (permissionId) => {
        const file = fileRef.current;
        if (!file) throw new AppError('not_found', 'No family');
        await drive.deletePermission(file.id, permissionId);
      },
    }),
    [auth, drive, sheets, repo, config, run, mutate, resolve, loadFile],
  );

  // On load: reuse a stored token, or try a silent refresh for a returning
  // user. Browsers may block that popup without a click; then the sign-in
  // button is the fallback.
  useEffect(() => {
    document.title = i18n.t('app.name');
    let cancelled = false;
    (async () => {
      if (!auth.hasSession() && !auth.isSignedIn()) {
        setSession({ status: 'signed_out' });
        return;
      }
      try {
        const token = auth.getToken() ?? (await auth.refreshSilently());
        if (cancelled) return;
        if (!token) {
          setSession({ status: 'signed_out', reason: 'expired' });
          return;
        }
        const { user } = await drive.about();
        userRef.current = user;
        auth.remember(user.emailAddress);
        await resolve();
      } catch (e) {
        if (!cancelled) fail(e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ session, busy, actions }), [session, busy, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

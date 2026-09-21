import { OAUTH_SCOPE } from '../config';
import { AppError } from './errors';
import type { TokenProvider } from './http';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const EXPIRY_MARGIN_MS = 60_000;
const STORAGE_KEY = 'pm.auth';

interface Persisted {
  token: string | null;
  expiresAt: number;
  /** Google account email, passed as `hint` so no account chooser appears. */
  hint: string | null;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      return { token: p.token ?? null, expiresAt: p.expiresAt ?? 0, hint: p.hint ?? null };
    }
  } catch {
    /* ignore */
  }
  return { token: null, expiresAt: 0, hint: null };
}

function save(p: Persisted) {
  try {
    if (!p.token && !p.hint) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

let gisLoading: Promise<void> | undefined;

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded === '1') return resolve();
    const s = existing ?? document.createElement('script');
    s.src = src;
    s.async = true;
    s.addEventListener('load', () => {
      s.dataset.loaded = '1';
      resolve();
    });
    s.addEventListener('error', () => reject(new AppError('network', `Failed to load ${src}`)));
    if (!existing) document.head.appendChild(s);
  });
}

export function loadGis(): Promise<void> {
  gisLoading ??= loadScript(GIS_SRC);
  return gisLoading;
}

export interface AuthClient extends TokenProvider {
  /** Interactive sign-in. Resolves to the token. */
  signIn(): Promise<string>;
  signOut(): Promise<void>;
  /** A usable token exists right now. */
  isSignedIn(): boolean;
  /** The user signed in before on this device (token may have expired). */
  hasSession(): boolean;
  /** Remember which account signed in, for hint-based silent refresh. */
  remember(email: string): void;
}

/**
 * Wraps the Google Identity Services token client. The access token and the
 * account hint are kept in localStorage so a reload within the token's
 * lifetime needs no interaction, and a later reload can refresh silently.
 * GIS delivers results through a single callback, so requests are serialized.
 */
export async function createAuthClient(clientId: string): Promise<AuthClient> {
  await loadGis();
  let state: Persisted = load();
  let pending: { resolve: (t: string | null) => void } | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: OAUTH_SCOPE,
    callback: (res) => {
      const p = pending;
      pending = null;
      if (res.error || !res.access_token) return p?.resolve(null);
      state = {
        ...state,
        token: res.access_token,
        expiresAt: Date.now() + Number(res.expires_in) * 1000,
      };
      save(state);
      p?.resolve(res.access_token);
    },
    error_callback: () => {
      const p = pending;
      pending = null;
      p?.resolve(null);
    },
  });

  function requestToken(prompt: '' | 'consent' | 'select_account'): Promise<string | null> {
    const run = () =>
      new Promise<string | null>((resolve) => {
        pending = { resolve };
        client.requestAccessToken(state.hint ? { prompt, hint: state.hint } : { prompt });
      });
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  }

  const valid = () => state.token !== null && state.expiresAt - EXPIRY_MARGIN_MS > Date.now();

  return {
    getToken: () => (valid() ? state.token : null),
    isSignedIn: valid,
    hasSession: () => state.hint !== null,
    remember(email) {
      state = { ...state, hint: email };
      save(state);
    },
    async refreshSilently() {
      if (!state.hint && !state.token) return null; // never signed in: no popups
      return requestToken('');
    },
    async signIn() {
      const t = await requestToken(state.hint ? '' : 'select_account');
      if (!t) throw new AppError('cancelled', 'Sign-in was cancelled');
      return t;
    },
    async signOut() {
      const t = state.token;
      state = { token: null, expiresAt: 0, hint: null };
      save(state);
      if (t) await new Promise<void>((r) => google.accounts.oauth2.revoke(t, () => r()));
    },
  };
}

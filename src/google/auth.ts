import { OAUTH_SCOPE } from '../config';
import { AppError } from './errors';
import type { TokenProvider } from './http';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const EXPIRY_MARGIN_MS = 60_000;

interface TokenState {
  token: string;
  expiresAt: number;
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
  isSignedIn(): boolean;
}

/**
 * Wraps the Google Identity Services token client. Tokens live in memory only.
 * GIS delivers results through a single callback, so requests are serialized.
 */
export async function createAuthClient(clientId: string): Promise<AuthClient> {
  await loadGis();
  let state: TokenState | null = null;
  let pending: { resolve: (t: string | null) => void } | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: OAUTH_SCOPE,
    callback: (res) => {
      const p = pending;
      pending = null;
      if (res.error || !res.access_token) return p?.resolve(null);
      state = { token: res.access_token, expiresAt: Date.now() + Number(res.expires_in) * 1000 };
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
        client.requestAccessToken({ prompt });
      });
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  }

  const valid = () => state !== null && state.expiresAt - EXPIRY_MARGIN_MS > Date.now();

  return {
    getToken: () => (valid() ? state!.token : null),
    isSignedIn: () => state !== null,
    async refreshSilently() {
      if (state === null) return null; // never signed in, do not pop anything up
      return requestToken('');
    },
    async signIn() {
      const t = await requestToken(state ? '' : 'select_account');
      if (!t) throw new AppError('cancelled', 'Sign-in was cancelled');
      return t;
    },
    async signOut() {
      const t = state?.token;
      state = null;
      if (t) await new Promise<void>((r) => google.accounts.oauth2.revoke(t, () => r()));
    },
  };
}

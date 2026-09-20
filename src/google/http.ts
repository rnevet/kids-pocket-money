import { AppError } from './errors';

export interface TokenProvider {
  /** Current token or null when signed out. */
  getToken(): string | null;
  /** Try to get a fresh token without user interaction. Null when that fails. */
  refreshSilently(): Promise<string | null>;
}

export interface Http {
  request<T>(url: string, init?: RequestInit): Promise<T>;
}

interface GoogleErrorBody {
  error?: { code?: number; message?: string; status?: string; errors?: { reason?: string }[] };
}

function classify(status: number, body: GoogleErrorBody): AppError {
  const message = body.error?.message ?? `HTTP ${status}`;
  const reason = body.error?.errors?.[0]?.reason ?? '';
  if (status === 401) return new AppError('auth', message, status);
  if (status === 429 || reason.includes('rateLimit') || reason.includes('quota')) {
    return new AppError('rate_limit', message, status);
  }
  if (status === 403) return new AppError('permission', message, status);
  if (status === 404) return new AppError('not_found', message, status);
  return new AppError('unknown', message, status);
}

/**
 * fetch with Bearer auth. On 401 it refreshes the token silently once and
 * retries. Anything else is mapped to an AppError.
 */
export function createHttp(tokens: TokenProvider, fetchImpl: typeof fetch = fetch): Http {
  async function once<T>(
    url: string,
    init: RequestInit,
    token: string,
  ): Promise<{ ok: true; value: T } | { ok: false; error: AppError }> {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      return {
        ok: false,
        error: new AppError('network', (e as Error).message, undefined, { cause: e }),
      };
    }
    if (res.ok) {
      if (res.status === 204) return { ok: true, value: undefined as T };
      const text = await res.text();
      return { ok: true, value: (text ? JSON.parse(text) : undefined) as T };
    }
    let body: GoogleErrorBody = {};
    try {
      body = (await res.json()) as GoogleErrorBody;
    } catch {
      /* non-JSON error body */
    }
    return { ok: false, error: classify(res.status, body) };
  }

  return {
    async request<T>(url: string, init: RequestInit = {}): Promise<T> {
      let token = tokens.getToken();
      if (!token) {
        token = await tokens.refreshSilently();
        if (!token) throw new AppError('auth', 'Not signed in', 401);
      }
      const first = await once<T>(url, init, token);
      if (first.ok) return first.value;
      if (first.error.kind !== 'auth') throw first.error;
      const fresh = await tokens.refreshSilently();
      if (!fresh) throw first.error;
      const second = await once<T>(url, init, fresh);
      if (second.ok) return second.value;
      throw second.error;
    },
  };
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

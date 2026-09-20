import { describe, expect, it, vi } from 'vitest';
import { createHttp, qs, type TokenProvider } from './http';
import { AppError } from './errors';

function tokens(
  initial: string | null,
  refreshed: string | null,
): TokenProvider & { refresh: ReturnType<typeof vi.fn> } {
  const refresh = vi.fn(async () => refreshed);
  return { getToken: () => initial, refreshSilently: refresh, refresh };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('createHttp', () => {
  it('sends the bearer token and parses JSON', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => json(200, { ok: 1 }));
    const http = createHttp(tokens('t1', null), fetchImpl as unknown as typeof fetch);
    await expect(http.request('https://x/y')).resolves.toEqual({ ok: 1 });
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t1');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { message: 'expired' } }))
      .mockResolvedValueOnce(json(200, { fine: true }));
    const t = tokens('old', 'new');
    const http = createHttp(t, fetchImpl as unknown as typeof fetch);
    await expect(http.request('https://x')).resolves.toEqual({ fine: true });
    expect(t.refresh).toHaveBeenCalledTimes(1);
    const second = fetchImpl.mock.calls[1]![1] as RequestInit;
    expect((second.headers as Record<string, string>).Authorization).toBe('Bearer new');
  });

  it('gives up after one failed refresh', async () => {
    const fetchImpl = vi.fn(async () => json(401, { error: { message: 'expired' } }));
    const http = createHttp(tokens('old', null), fetchImpl as unknown as typeof fetch);
    await expect(http.request('https://x')).rejects.toMatchObject({ kind: 'auth' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry twice', async () => {
    const fetchImpl = vi.fn(async () => json(401, {}));
    const http = createHttp(tokens('old', 'new'), fetchImpl as unknown as typeof fetch);
    await expect(http.request('https://x')).rejects.toBeInstanceOf(AppError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('classifies errors', async () => {
    const cases: [number, unknown, string][] = [
      [403, { error: { errors: [{ reason: 'insufficientFilePermissions' }] } }, 'permission'],
      [403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }, 'rate_limit'],
      [404, {}, 'not_found'],
      [429, {}, 'rate_limit'],
      [500, {}, 'unknown'],
    ];
    for (const [status, body, kind] of cases) {
      const http = createHttp(tokens('t', 't'), (async () => json(status, body)) as typeof fetch);
      await expect(http.request('https://x')).rejects.toMatchObject({ kind, status });
    }
  });

  it('maps fetch failures to network', async () => {
    const http = createHttp(tokens('t', 't'), (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch);
    await expect(http.request('https://x')).rejects.toMatchObject({ kind: 'network' });
  });

  it('handles 204 and empty bodies', async () => {
    const http = createHttp(
      tokens('t', 't'),
      (async () => new Response(null, { status: 204 })) as typeof fetch,
    );
    await expect(http.request('https://x')).resolves.toBeUndefined();
  });

  it('qs skips undefined', () => {
    expect(qs({ a: 1, b: undefined, c: 'x y' })).toBe('?a=1&c=x+y');
    expect(qs({})).toBe('');
  });
});

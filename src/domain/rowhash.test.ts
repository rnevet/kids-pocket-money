import { describe, expect, it } from 'vitest';
import { canonical, hashRow, verifyRow } from './rowhash';

describe('rowhash', () => {
  // Pinned vectors: if these change, every existing sheet becomes unreadable.
  it('pinned test vectors', async () => {
    expect(canonical(['a', 'b'])).toBe('v1\u001fa\u001fb');
    expect(await hashRow([])).toBe('3bfc269594ef6492');
    expect(await hashRow(['a', 'b'])).toBe('ad9a6ee0c8a88b83');
    expect(
      await hashRow([
        't1',
        'k1',
        '2026-09-20',
        '12.50',
        'deposit',
        '',
        'a@b.c',
        '2026-09-20T10:00:00.000Z',
      ]),
    ).toBe('005a6f24f5832691');
  });
  it('verifies, case-insensitive on the hash', async () => {
    const h = await hashRow(['x']);
    expect(await verifyRow(['x'], h)).toBe(true);
    expect(await verifyRow(['x'], h.toUpperCase())).toBe(true);
    expect(await verifyRow(['x'], ` ${h} `)).toBe(true);
    expect(await verifyRow(['y'], h)).toBe(false);
    expect(await verifyRow(['x'], '')).toBe(false);
  });
  it('refuses the separator inside a field', () => {
    expect(() => canonical(['a\u001fb'])).toThrow();
  });
});

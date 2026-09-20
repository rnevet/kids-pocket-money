/**
 * Tamper evidence for sheet rows. See SPEC.md "Row hash".
 *
 * hash = first 16 hex chars of SHA-256("v1" + SEP + fields.join(SEP))
 *
 * This is public and unsalted by design (static app). It detects accidental
 * and casual edits; it is not a security boundary.
 */
export const HASH_VERSION = 'v1';
export const HASH_LENGTH = 16;
const SEP = '\u001f';

export function canonical(fields: readonly string[]): string {
  for (const f of fields) {
    if (f.includes(SEP)) throw new RangeError('field contains the separator byte');
  }
  return [HASH_VERSION, ...fields].join(SEP);
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashRow(fields: readonly string[]): Promise<string> {
  return (await sha256Hex(canonical(fields))).slice(0, HASH_LENGTH);
}

export async function verifyRow(fields: readonly string[], hash: string): Promise<boolean> {
  const expected = await hashRow(fields);
  return timingSafeEqual(expected, hash.trim().toLowerCase());
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

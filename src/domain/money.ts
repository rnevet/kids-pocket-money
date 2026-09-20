/**
 * Money is handled as integer minor units (agorot, cents). Every currency is
 * treated as having two decimals in the sheet, which keeps the storage format
 * uniform. Display formatting is left to Intl.
 */
export type Minor = number;

const AMOUNT_RE = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/** Parse a sheet cell such as "12.50", "-3", "0.5" into minor units. */
export function parseAmount(cell: string): Minor | null {
  const m = AMOUNT_RE.exec(cell.trim());
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  const whole = Number(m[2]);
  const frac = (m[3] ?? '').padEnd(2, '0');
  const minor = whole * 100 + Number(frac);
  if (!Number.isSafeInteger(minor)) return null;
  return sign * minor;
}

/** Format minor units as the canonical sheet cell: "-12.50". */
export function formatAmountCell(minor: Minor): string {
  if (!Number.isInteger(minor))
    throw new TypeError(`amount must be integer minor units, got ${minor}`);
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

export function sum(amounts: Iterable<Minor>): Minor {
  let total = 0;
  for (const a of amounts) total += a;
  return total;
}

/** Display formatting through Intl. Always two fraction digits for consistency with the sheet. */
export function formatMoney(minor: Minor, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `${formatAmountCell(minor)} ${currency}`;
  }
}

/** Parse user input from a form field. Accepts a comma as decimal separator too. */
export function parseUserAmount(input: string): Minor | null {
  return parseAmount(input.replace(',', '.').replace(/\s/g, ''));
}

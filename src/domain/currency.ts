export const PINNED_CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'] as const;

/** Pinned currencies first, then every ISO 4217 code the runtime knows. */
export function currencyOptions(): string[] {
  let all: string[];
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    all = intl.supportedValuesOf?.('currency') ?? [];
  } catch {
    all = [];
  }
  const rest = all.filter((c) => !(PINNED_CURRENCIES as readonly string[]).includes(c)).sort();
  return [...PINNED_CURRENCIES, ...rest];
}

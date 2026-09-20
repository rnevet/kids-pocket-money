import { describe, expect, it } from 'vitest';
import { formatAmountCell, formatMoney, parseAmount, parseUserAmount, sum } from './money';

describe('parseAmount', () => {
  it('parses canonical and loose forms', () => {
    expect(parseAmount('12.50')).toBe(1250);
    expect(parseAmount('12.5')).toBe(1250);
    expect(parseAmount('12')).toBe(1200);
    expect(parseAmount('-3.07')).toBe(-307);
    expect(parseAmount(' 0.5 ')).toBe(50);
    expect(parseAmount('0')).toBe(0);
  });
  it('rejects garbage', () => {
    for (const s of ['', 'abc', '1.234', '1,50', '+5', '1e3', '--1', '.5']) {
      expect(parseAmount(s)).toBeNull();
    }
  });
});

describe('formatAmountCell', () => {
  it('round-trips', () => {
    for (const n of [0, 1, 99, 100, 1250, -307, 123456789]) {
      expect(parseAmount(formatAmountCell(n))).toBe(n);
    }
    expect(formatAmountCell(-5)).toBe('-0.05');
    expect(formatAmountCell(1250)).toBe('12.50');
  });
  it('refuses floats', () => {
    expect(() => formatAmountCell(12.5)).toThrow();
  });
});

describe('sum / formatMoney / parseUserAmount', () => {
  it('sums exactly', () => {
    expect(sum([10, 20, -5])).toBe(25);
    expect(sum([])).toBe(0);
  });
  it('formats with Intl', () => {
    expect(formatMoney(1250, 'USD', 'en-US')).toBe('$12.50');
    expect(formatMoney(-1250, 'EUR', 'en-US')).toBe('-€12.50');
  });
  it('accepts a decimal comma from users', () => {
    expect(parseUserAmount('12,5')).toBe(1250);
    expect(parseUserAmount('1 000')).toBe(100000);
  });
});

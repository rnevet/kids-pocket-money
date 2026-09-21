import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { paydaysToGoal } from '../domain/goals';
import { formatMoney, type Minor } from '../domain/money';
import type { IsoDate } from '../domain/dates';
import type { Goal, Kid } from '../domain/schema';
import type { AppError } from '../google/errors';

export function useFormat() {
  const { i18n, t } = useTranslation();
  const locale = i18n.language;
  return {
    locale,
    money: (minor: Minor, currency: string) => formatMoney(minor, currency, locale),
    /** "₪" for ILS, "€" for EUR; falls back to the code. */
    currencySymbol: (currency: string) => {
      try {
        return (
          new Intl.NumberFormat(locale, { style: 'currency', currency })
            .formatToParts(0)
            .find((p) => p.type === 'currency')?.value ?? currency
        );
      } catch {
        return currency;
      }
    },
    number: (n: number) => new Intl.NumberFormat(locale).format(n),
    date: (iso: IsoDate) => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        new Date(y!, m! - 1, d),
      );
    },
    time: (epochMs: number) =>
      new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(epochMs)),
    weekday: (day: number) => {
      // 2026-09-20 is a Sunday; any known Sunday works as an anchor.
      const anchor = new Date(2026, 8, 20 + day);
      return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(anchor);
    },
    percent: (ratio: number) =>
      new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(ratio),
    error: (e: AppError) =>
      t(`errors.${e.kind}`, {
        message: e.message,
        defaultValue: t('errors.unknown', { message: e.message }),
      }),
  };
}

/** Sentences a kid reads: how far a goal is, and what the allowance is. */
export function useWords() {
  const { t } = useTranslation();
  const f = useFormat();
  return {
    /** "9 more Fridays", "Next month!", "₪12.00 to go", "You have enough!" */
    goalForecast: (kid: Kid, balance: Minor, goal: Goal): string => {
      const remaining = goal.price - balance;
      if (remaining <= 0) return t('goal.enough');
      const n =
        kid.allowanceFrequency === 'none' ? null : paydaysToGoal(remaining, kid.allowanceAmount);
      if (n === null) return t('goal.toGo', { amount: f.money(remaining, kid.currency) });
      if (kid.allowanceFrequency === 'weekly')
        return t('goal.weeks', { count: n, weekday: f.weekday(kid.allowanceDay) });
      return t('goal.months', { count: n });
    },
    /** "₪30 every Friday", "₪100 every month", or null without an allowance. */
    allowance: (kid: Kid): string | null => {
      if (kid.allowanceFrequency === 'none' || kid.allowanceAmount <= 0) return null;
      const amount = f.money(kid.allowanceAmount, kid.currency);
      return kid.allowanceFrequency === 'weekly'
        ? t('home.allowanceWeekly', { amount, weekday: f.weekday(kid.allowanceDay) })
        : t('home.allowanceMonthly', { amount });
    },
  };
}

/** Re-renders every `everyMs` so relative times stay honest. */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** Which of the account colours a kid gets: stable by position in the sheet. */
export const TINT_COUNT = 4;
export function kidTint(kids: readonly Kid[], kidId: string): number {
  const i = kids.findIndex((k) => k.id === kidId);
  return (Math.max(0, i) % TINT_COUNT) + 1;
}

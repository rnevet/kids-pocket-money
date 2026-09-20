import { useTranslation } from 'react-i18next';
import { formatMoney, type Minor } from '../domain/money';
import type { IsoDate } from '../domain/dates';
import type { AppError } from '../google/errors';

export function useFormat() {
  const { i18n, t } = useTranslation();
  const locale = i18n.language;
  return {
    locale,
    money: (minor: Minor, currency: string) => formatMoney(minor, currency, locale),
    date: (iso: IsoDate) => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        new Date(y!, m! - 1, d),
      );
    },
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

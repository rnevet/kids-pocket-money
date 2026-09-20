import type { Minor } from '../../domain/money';
import { useFormat } from '../format';

export function Money({
  minor,
  currency,
  big = false,
  signed = false,
}: {
  minor: Minor;
  currency: string;
  big?: boolean;
  signed?: boolean;
}) {
  const f = useFormat();
  const cls = [
    'money',
    big && 'money--big',
    signed && minor > 0 && 'money--positive',
    signed && minor < 0 && 'money--negative',
  ]
    .filter(Boolean)
    .join(' ');
  const text = f.money(minor, currency);
  return <span className={cls}>{signed && minor > 0 ? `+${text}` : text}</span>;
}

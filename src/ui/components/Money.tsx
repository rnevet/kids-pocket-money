import type { Minor } from '../../domain/money';
import { useFormat } from '../format';

export function Money({
  minor,
  currency,
  big = false,
  signed = false,
  className,
}: {
  minor: Minor;
  currency: string;
  big?: boolean;
  /** Show a leading "+" and colour money that came in. Money that went out stays ink. */
  signed?: boolean;
  className?: string;
}) {
  const f = useFormat();
  const cls = [
    'money',
    big && 'money--big',
    signed && minor > 0 && 'money--positive',
    signed && minor < 0 && 'money--negative',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const text = f.money(minor, currency);
  return <span className={cls}>{signed && minor > 0 ? `+${text}` : text}</span>;
}

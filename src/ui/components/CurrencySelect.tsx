import { useMemo } from 'react';
import { currencyOptions, PINNED_CURRENCIES } from '../../domain/currency';

export function CurrencySelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const options = useMemo(() => currencyOptions(), []);
  const pinned = new Set<string>(PINNED_CURRENCIES);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <optgroup label="★">
        {options
          .filter((c) => pinned.has(c))
          .map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
      </optgroup>
      <optgroup label="…">
        {options
          .filter((c) => !pinned.has(c))
          .map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
      </optgroup>
    </select>
  );
}

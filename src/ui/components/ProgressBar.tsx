export function ProgressBar({
  value,
  label,
  neutral = false,
}: {
  value: number;
  label?: string;
  /** On a plain card (not a tinted one) the track needs its own colour. */
  neutral?: boolean;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={neutral ? 'progress progress--neutral' : 'progress'}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress__bar" style={{ inlineSize: `${pct}%` }} />
    </div>
  );
}

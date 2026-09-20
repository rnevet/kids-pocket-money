const EMOJIS = [
  '🦊',
  '🐱',
  '🐶',
  '🐼',
  '🦁',
  '🐸',
  '🐵',
  '🦄',
  '🐧',
  '🦋',
  '🐢',
  '🐙',
  '🚀',
  '⚽',
  '🎨',
  '🎸',
  '🌈',
  '⭐',
  '🍕',
  '🧁',
  '👧',
  '👦',
  '🧒',
  '👶',
];

export function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="emoji-grid" role="radiogroup">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          aria-pressed={value === e}
          onClick={() => onChange(e)}
          aria-label={e}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

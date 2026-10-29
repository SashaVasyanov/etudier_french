import { AppIcon } from './AppIcon';

interface HintButtonProps {
  /** What the hint does, for the tooltip and screen readers. */
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

/** The round key button: one more clue toward the answer. */
export function HintButton({ label, disabled = false, onClick }: HintButtonProps) {
  return (
    <button type="button" className="hint-key-button" title={label} aria-label={label} disabled={disabled} onClick={onClick}>
      <AppIcon name="key" size={20} />
    </button>
  );
}

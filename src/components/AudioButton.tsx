interface AudioButtonProps {
  disabled?: boolean;
  label?: string;
  onClick: () => void;
}

export function AudioButton({ disabled, label = 'Аудио', onClick }: AudioButtonProps) {
  return (
    <button type="button" className="audio-button audio-button-inline" disabled={disabled} onClick={onClick}>
      <span className="audio-button-dot" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

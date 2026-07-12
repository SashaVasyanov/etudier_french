import { AppIcon } from './AppIcon';

interface AudioButtonProps {
  disabled?: boolean;
  label?: string;
  onClick: () => void;
}

export function AudioButton({ disabled, label = 'Аудио', onClick }: AudioButtonProps) {
  return (
    <button type="button" className="audio-button audio-button-inline" disabled={disabled} onClick={onClick}>
      <AppIcon name="volume" size={18} />
      <span>{label}</span>
    </button>
  );
}

import { IconButton } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';

const FORMAT_COMMANDS = [
  { icon: 'format_bold', cmd: 'bold', label: 'Bold', shortcut: 'Ctrl+B' },
  { icon: 'format_italic', cmd: 'italic', label: 'Italic', shortcut: 'Ctrl+I' },
  { icon: 'format_underlined', cmd: 'underline', label: 'Underline', shortcut: 'Ctrl+U' },
  { icon: 'strikethrough_s', cmd: 'strike', label: 'Strikethrough', shortcut: '' }
];

const LIST_COMMANDS = [
  { icon: 'format_list_bulleted', cmd: 'bulletList', label: 'Bullet List', shortcut: '' },
  { icon: 'format_list_numbered', cmd: 'orderedList', label: 'Numbered List', shortcut: '' }
];

interface FormattingButtonsProps {
  onFormatClick: (cmd: string) => void;
  isActive: (cmd: string) => boolean;
}

export { FORMAT_COMMANDS, LIST_COMMANDS };

export function FormattingButtons({ onFormatClick, isActive }: FormattingButtonsProps) {
  return (
    <>
      {FORMAT_COMMANDS.map(({ icon, cmd, label, shortcut }) => (
        <Tooltip key={cmd} content={shortcut ? `${label} (${shortcut})` : label} position="bottom">
          <IconButton
            icon={icon}
            label={shortcut ? `${label} (${shortcut})` : label}
            variant="ghost"
            active={isActive(cmd)}
            onClick={() => onFormatClick(cmd)}
          />
        </Tooltip>
      ))}
    </>
  );
}

export function ListButtons({ onFormatClick, isActive }: FormattingButtonsProps) {
  return (
    <>
      {LIST_COMMANDS.map(({ icon, cmd, label }) => (
        <Tooltip key={cmd} content={label} position="bottom">
          <IconButton
            icon={icon}
            label={label}
            variant="ghost"
            active={isActive(cmd)}
            onClick={() => onFormatClick(cmd)}
          />
        </Tooltip>
      ))}
    </>
  );
}

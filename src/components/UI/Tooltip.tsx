import { useState, useRef, useEffect, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ content, children, position = 'top', delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hideTooltip = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <div
      ref={triggerRef}
      className={styles.tooltipWrapper}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {visible && (
        <div className={`${styles.tooltip} ${styles[`tooltip--${position}`]}`} role="tooltip">
          {content}
        </div>
      )}
    </div>
  );
}

// Contextual help tooltip with an icon trigger
interface HelpTooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function HelpTooltip({ text, position = 'top' }: HelpTooltipProps) {
  return (
    <Tooltip content={text} position={position}>
      <span className={styles.helpIcon}>
        <span className="material-symbols-rounded">help_outline</span>
      </span>
    </Tooltip>
  );
}

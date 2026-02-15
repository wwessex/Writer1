import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton } from './Button';
import { useWindowResize } from '@/hooks/useResizable';
import styles from './Dialog.module.css';

const SIZE_DEFAULTS: Record<string, { w: number; h: number; maxW: number; maxH: number }> = {
  small:  { w: 400, h: 360, maxW: 560, maxH: 600 },
  medium: { w: 600, h: 480, maxW: 900, maxH: 800 },
  large:  { w: 900, h: 560, maxW: 1200, maxH: 900 },
};

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'medium'
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 820);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const defaults = SIZE_DEFAULTS[size] || SIZE_DEFAULTS.medium;
  const { width, height, startResize, reset } = useWindowResize({
    initialWidth: defaults.w,
    initialHeight: defaults.h,
    minWidth: 300,
    maxWidth: defaults.maxW,
    minHeight: 200,
    maxHeight: defaults.maxH,
    disabled: isMobile,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      reset();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, reset]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) {
        onClose();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  const sizeClass = styles[`modal--${size}`];

  return (
    <dialog ref={dialogRef} className={`${styles.modal} ${sizeClass}`}>
      <div
        className={styles.modal__card}
        style={!isMobile ? { width, height, maxWidth: 'none', maxHeight: 'none' } : undefined}
      >
        <div className={styles.modal__header}>
          <h2 className={styles.modal__title}>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className={styles.modal__body}>{children}</div>
        {footer && <div className={styles.modal__footer}>{footer}</div>}
        {!isMobile && (
          <>
            <div className={`${styles.resizeHandle} ${styles['resizeHandle--right']}`} onMouseDown={startResize('right')} />
            <div className={`${styles.resizeHandle} ${styles['resizeHandle--bottom']}`} onMouseDown={startResize('bottom')} />
            <div className={styles.resizeCorner} onMouseDown={startResize('bottom-right')} />
          </>
        )}
      </div>
    </dialog>
  );
}

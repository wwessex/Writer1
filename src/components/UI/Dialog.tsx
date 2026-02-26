import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  const [isClosing, setIsClosing] = useState(false);

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

  const handleClose = useCallback(() => {
    if (isClosing) return;
    const dialog = dialogRef.current;
    if (!dialog?.open) { onClose(); return; }

    setIsClosing(true);
    const card = dialog.querySelector(`.${styles.modal__card}`);
    const done = () => {
      setIsClosing(false);
      dialog.close();
      onClose();
    };
    if (card) {
      card.addEventListener('animationend', done, { once: true });
      setTimeout(done, 250); // fallback
    } else {
      done();
    }
  }, [isClosing, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setIsClosing(false);
      dialog.showModal();
      reset();
    } else if (!open && dialog.open && !isClosing) {
      dialog.close();
    }
  }, [open, reset, isClosing]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onNativeClose = () => { if (!isClosing) onClose(); };
    const onClick = (e: MouseEvent) => {
      if (e.target === dialog) handleClose();
    };

    dialog.addEventListener('close', onNativeClose);
    dialog.addEventListener('click', onClick);

    return () => {
      dialog.removeEventListener('close', onNativeClose);
      dialog.removeEventListener('click', onClick);
    };
  }, [onClose, handleClose, isClosing]);

  const sizeClass = styles[`modal--${size}`];
  const closingClass = isClosing ? styles['modal--closing'] : '';

  return (
    <dialog ref={dialogRef} className={`${styles.modal} ${sizeClass} ${closingClass}`}>
      <div
        className={styles.modal__card}
        style={!isMobile ? { width, height, maxWidth: 'none', maxHeight: 'none' } : undefined}
      >
        <div className={styles.modal__header}>
          <h2 className={styles.modal__title}>{title}</h2>
          <IconButton icon="close" label="Close" onClick={handleClose} />
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

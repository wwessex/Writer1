import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';
import styles from './Dialog.module.css';

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

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
      <div className={styles.modal__card}>
        <div className={styles.modal__header}>
          <h2 className={styles.modal__title}>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className={styles.modal__body}>{children}</div>
        {footer && <div className={styles.modal__footer}>{footer}</div>}
      </div>
    </dialog>
  );
}

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'default' | 'small' | 'icon';
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', className, children, ...props }, ref) => {
    const classes = [
      styles.btn,
      styles[`btn--${variant}`],
      styles[`btn--${size}`],
      className
    ].filter(Boolean).join(' ');

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label?: string;
  variant?: 'default' | 'ghost' | 'square';
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant = 'default', active, className, ...props }, ref) => {
    const classes = [
      styles.iconBtn,
      variant === 'square' && styles['iconBtn--square'],
      variant === 'ghost' && styles['iconBtn--ghost'],
      active && styles['iconBtn--active'],
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        title={label}
        aria-label={label}
        {...props}
      >
        <span className="material-symbols-rounded">{icon}</span>
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

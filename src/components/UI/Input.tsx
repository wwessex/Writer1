import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'title';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = 'default', className, ...props }, ref) => {
    const classes = [
      styles.input,
      variant === 'title' && styles['input--title'],
      className
    ].filter(Boolean).join(' ');

    return <input ref={ref} className={classes} {...props} />;
  }
);

Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'area';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ variant: _variant = 'default', className, ...props }, ref) => {
    const classes = [
      styles.input,
      styles['input--area'],
      className
    ].filter(Boolean).join(' ');

    return <textarea ref={ref} className={classes} {...props} />;
  }
);

Textarea.displayName = 'Textarea';

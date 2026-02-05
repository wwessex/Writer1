import type { ReactNode } from 'react';
import styles from './Pill.module.css';

interface PillProps {
  label?: string;
  value: ReactNode;
  variant?: 'default' | 'accent' | 'success' | 'warning';
}

export function Pill({ label, value, variant = 'default' }: PillProps) {
  return (
    <span className={`${styles.pill} ${styles[`pill--${variant}`]}`}>
      {label && <span className={styles.pill__label}>{label}</span>}
      <span className={styles.pill__value}>{value}</span>
    </span>
  );
}

interface StatusDotProps {
  online: boolean;
}

export function StatusDot({ online }: StatusDotProps) {
  return (
    <span
      className={`${styles.dot} ${online ? styles['dot--online'] : styles['dot--offline']}`}
      title={online ? 'Online' : 'Offline'}
    />
  );
}

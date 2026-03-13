import styles from '../Windows.module.css';

interface SettingsSectionProps {
  id: string;
  title: string;
  icon: string;
  isCollapsed: boolean;
  onToggle: () => void;
  highlightMatch: (text: string) => React.ReactNode;
  sectionRef: (el: HTMLElement | null) => void;
  children: React.ReactNode;
}

export function SettingsSection({ title, icon, isCollapsed, onToggle, highlightMatch, sectionRef, children }: SettingsSectionProps) {
  return (
    <section className={styles.section} ref={sectionRef}>
      <button className={styles.sectionToggle} onClick={onToggle}>
        <h4>
          <span className="material-symbols-rounded">{icon}</span>
          {highlightMatch(title)}
        </h4>
        <span className={`material-symbols-rounded ${styles.sectionChevron}`}>
          {isCollapsed ? 'expand_more' : 'expand_less'}
        </span>
      </button>
      {!isCollapsed && (
        <div className={styles.sectionContent}>
          {children}
        </div>
      )}
    </section>
  );
}

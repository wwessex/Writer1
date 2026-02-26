import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { COMMAND_IDS, LOCAL_MENU_COMMANDS, isCommandEnabled, type CommandId } from '@/lib/commands';
import { APP_MENUS } from '@/lib/menuConfig';
import { getCurrentPlatform, normalizeShortcut } from '@/lib/nativeMenuAdapter';
import styles from './Menu.module.css';

interface MenuBarProps {
  onAction?: (action: CommandId) => void;
  editorFocused?: boolean;
  hasSelection?: boolean;
}

export function MenuBar({ onAction, editorFocused = false, hasSelection = false }: MenuBarProps) {
  const { state } = useApp();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [closingMenu, setClosingMenu] = useState<string | null>(null);
  const platform = getCurrentPlatform();
  const menuBarRef = useRef<HTMLDivElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);

  const closeMenuAnimated = useCallback((callback?: () => void) => {
    if (!openMenu) { callback?.(); return; }
    setClosingMenu(openMenu);
    const dropdown = menuDropdownRef.current;
    const done = () => {
      setClosingMenu(null);
      setOpenMenu(null);
      callback?.();
    };
    if (dropdown) {
      dropdown.addEventListener('animationend', done, { once: true });
      setTimeout(done, 160); // fallback
    } else {
      done();
    }
  }, [openMenu]);

  const handleMenuClick = (menuLabel: string) => {
    if (openMenu === menuLabel) {
      closeMenuAnimated();
    } else if (openMenu) {
      // Switch directly without exit animation for snappiness
      setClosingMenu(null);
      setOpenMenu(menuLabel);
    } else {
      setOpenMenu(menuLabel);
    }
  };

  const handleItemClick = (action: CommandId) => {
    setClosingMenu(null);
    setOpenMenu(null);

    if (LOCAL_MENU_COMMANDS.has(action)) {
      onAction?.(action);
      return;
    }

    onAction?.(action);
  };

  // Track whether a touch moved (scrolled) so we don't close the menu on scroll
  const touchMovedRef = useRef(false);

  const handleTouchStart = useCallback(() => {
    touchMovedRef.current = false;
  }, []);

  const handleTouchMove = useCallback(() => {
    touchMovedRef.current = true;
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    // Ignore if this was a scroll gesture, not a tap
    if (touchMovedRef.current) return;
    if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
      closeMenuAnimated();
    }
  }, [closeMenuAnimated]);

  useEffect(() => {
    if (openMenu) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [openMenu, handleClickOutside, handleTouchStart, handleTouchMove]);

  return (
    <nav className={styles.menuBar} ref={menuBarRef} role="menubar" aria-label="Main menu">
      {APP_MENUS.map(menu => {
        const items = menu.label === 'File'
          ? menu.items.map(item => item.action === COMMAND_IDS.NEW_CHAPTER
            ? { ...item, label: state.projectType === 'screenplay' ? 'New Scene' : 'New Chapter' }
            : item)
          : menu.items;

        return (
        <div key={menu.label} className={styles.menuWrapper}>
          <button
            className={`${styles.menuBtn} ${openMenu === menu.label ? styles['menuBtn--active'] : ''}`}
            onClick={() => handleMenuClick(menu.label)}
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={openMenu === menu.label}
          >
            {menu.label}
          </button>
          {(openMenu === menu.label || closingMenu === menu.label) && (
            <div ref={openMenu === menu.label ? menuDropdownRef : undefined} className={`${styles.menu} ${closingMenu === menu.label ? styles['menu--closing'] : ''}`} role="menu">
              {items.map((item, idx) =>
                item.divider ? (
                  <div key={idx} className={styles.menuDivider} role="separator" />
                ) : (
                  <button
                    key={idx}
                    className={styles.menuItem}
                    onClick={() => item.action && handleItemClick(item.action)}
                    disabled={item.action ? !isCommandEnabled(item.action, { editorFocused, hasSelection }) : item.disabled}
                    role="menuitem"
                  >
                    <span className={styles.menuItem__label}>{item.label}</span>
                    {item.shortcut && (
                      <span className={styles.menuItem__shortcut}>{normalizeShortcut(item.shortcut, platform)}</span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
        );
      })}
    </nav>
  );
}

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(', ');

let scrollLockCount = 0;
let previousBodyOverflow = '';

function lockBackgroundScroll() {
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}

function unlockBackgroundScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden')
  );
}

interface UseModalAccessibilityOptions {
  enabled: boolean;
  onRequestClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
}

export function useModalAccessibility({ enabled, onRequestClose, containerRef }: UseModalAccessibilityOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onRequestCloseRef = useRef(onRequestClose);

  useEffect(() => {
    onRequestCloseRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (!enabled) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef.current;
    if (!container) return;

    lockBackgroundScroll();

    const focusFirstInteractiveElement = () => {
      const focusable = getFocusableElements(container);
      (focusable[0] ?? container).focus();
    };

    const frame = window.requestAnimationFrame(focusFirstInteractiveElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      unlockBackgroundScroll();

      const previous = previousFocusRef.current;
      if (previous && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [containerRef, enabled]);
}

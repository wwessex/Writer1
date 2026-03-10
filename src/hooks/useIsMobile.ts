const MOBILE_BREAKPOINT = '(max-width: 820px)';

export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT).matches;
}

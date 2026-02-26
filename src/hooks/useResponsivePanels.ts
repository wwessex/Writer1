import { useEffect, useState } from 'react';

export const RESPONSIVE_BREAKPOINTS = {
  /**
   * Keep both utility panels open above this width where the layout still has
   * room for readable line length in the editor.
   */
  inspectorAutoCollapse: 1360,
  /**
   * Collapse the left sidebar below this width to prioritize editor space.
   * The right inspector is already collapsed before this point.
   */
  sidebarAutoCollapse: 1140,
} as const;

interface ResponsivePanelsState {
  shouldCollapseSidebar: boolean;
  shouldCollapseInspector: boolean;
}

function getResponsivePanelState(width: number): ResponsivePanelsState {
  return {
    shouldCollapseSidebar: width < RESPONSIVE_BREAKPOINTS.sidebarAutoCollapse,
    shouldCollapseInspector: width < RESPONSIVE_BREAKPOINTS.inspectorAutoCollapse,
  };
}

export function useResponsivePanels(): ResponsivePanelsState {
  const [state, setState] = useState<ResponsivePanelsState>(() => {
    if (typeof window === 'undefined') {
      return {
        shouldCollapseSidebar: false,
        shouldCollapseInspector: false,
      };
    }

    return getResponsivePanelState(window.innerWidth);
  });

  useEffect(() => {
    const onResize = () => {
      setState(getResponsivePanelState(window.innerWidth));
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return state;
}


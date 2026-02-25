/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { SidebarSection } from './SidebarSection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SidebarSection', () => {
  it('renders title and children', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(
        <SidebarSection title="My Section">
          <div>Child content</div>
        </SidebarSection>
      );
    });

    expect(container.textContent).toContain('My Section');
    expect(container.textContent).toContain('Child content');
    act(() => root.unmount());
  });
});

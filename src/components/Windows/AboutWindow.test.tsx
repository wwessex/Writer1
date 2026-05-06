/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AboutWindow } from './AboutWindow';

const mocks = vi.hoisted(() => ({
  theme: 'dark' as 'auto' | 'light' | 'dark',
  createDiagnosticsReportMock: vi.fn(async () => '{"ok":true}'),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      settings: {
        theme: mocks.theme,
      },
    },
  }),
}));

vi.mock('@/hooks/useResizable', () => ({
  useWindowResize: () => ({
    width: 400,
    height: 480,
    startResize: () => () => undefined,
    reset: () => undefined,
  }),
}));

vi.mock('@/lib/errors', () => ({
  createDiagnosticsReport: mocks.createDiagnosticsReportMock,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderAboutWindow({ open = true, onClose = () => undefined }: { open?: boolean; onClose?: () => void } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<AboutWindow open={open} onClose={onClose} />);
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  mocks.createDiagnosticsReportMock.mockClear();
});

describe('AboutWindow', () => {
  it('returns null when closed', () => {
    const rendered = renderAboutWindow({ open: false });
    expect(rendered.container.textContent).toBe('');
    rendered.unmount();
  });

  it('uses light-theme logo asset when theme is light', () => {
    mocks.theme = 'light';
    const rendered = renderAboutWindow();

    const logo = rendered.container.querySelector('img[alt="DraftHarbour Studio"]');
    expect(logo).not.toBeNull();
    expect(logo?.getAttribute('src')).toContain('assets/logo-black.svg');

    rendered.unmount();
  });

  it('uses dark-theme logo asset when theme is dark', () => {
    mocks.theme = 'dark';
    const rendered = renderAboutWindow();

    const logo = rendered.container.querySelector('img[alt="DraftHarbour Studio"]');
    expect(logo).not.toBeNull();
    expect(logo?.getAttribute('src')).toContain('assets/logo-blue.svg');

    rendered.unmount();
  });

  it('calls onClose when escape is pressed and when close controls are used', () => {
    const onClose = vi.fn();
    const rendered = renderAboutWindow({ onClose });

    const closeButton = rendered.container.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    const backdrop = rendered.container.querySelector('[class*="backdrop"]') as HTMLDivElement;

    act(() => {
      closeButton.click();
      backdrop.click();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(3);
    rendered.unmount();
  });

  it('creates diagnostics report when requested', async () => {
    const rendered = renderAboutWindow();

    const createButton = Array.from(rendered.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create Diagnostics Report')
    ) as HTMLButtonElement;

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:test-url');
    URL.revokeObjectURL = vi.fn();

    act(() => {
      createButton.click();
    });

    await Promise.resolve();

    expect(mocks.createDiagnosticsReportMock).toHaveBeenCalledTimes(1);

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;

    rendered.unmount();
  });
});

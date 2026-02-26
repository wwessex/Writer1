/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('./Dialog.module.css', () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

vi.mock('./Button', () => ({
  IconButton: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button aria-label={label} onClick={onClick}>{label}</button>
  ),
}));

vi.mock('@/hooks/useResizable', () => ({
  useWindowResize: () => ({
    width: 600,
    height: 480,
    startResize: () => () => {},
    reset: vi.fn(),
  }),
}));

// Patch <dialog> methods — jsdom does not implement showModal/close/.open
function patchDialog(dialog: HTMLDialogElement) {
  let isOpen = false;
  Object.defineProperty(dialog, 'open', {
    get: () => isOpen,
    configurable: true,
  });
  dialog.showModal = vi.fn(() => { isOpen = true; });
  dialog.close = vi.fn(() => {
    isOpen = false;
    dialog.dispatchEvent(new Event('close'));
  });
}

describe('Dialog', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let onCloseMock: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onCloseMock = vi.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('renders a dialog element', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test Dialog">
          <p>Body</p>
        </Dialog>
      );
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
  });

  it('renders the title', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="My Title">
          <p>Body</p>
        </Dialog>
      );
    });
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toBe('My Title');
  });

  it('renders children in the body', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Hello World</p>
        </Dialog>
      );
    });
    expect(container.textContent).toContain('Hello World');
  });

  it('renders footer when provided', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test" footer={<span>Footer content</span>}>
          <p>Body</p>
        </Dialog>
      );
    });
    expect(container.textContent).toContain('Footer content');
  });

  it('does not render footer when not provided', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    const footerDiv = container.querySelector('.modal__footer');
    expect(footerDiv).toBeNull();
  });

  it('applies size class based on size prop', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test" size="large">
          <p>Body</p>
        </Dialog>
      );
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.className).toContain('modal--large');
  });

  it('defaults to medium size', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.className).toContain('modal--medium');
  });

  it('calls showModal when open becomes true', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    patchDialog(dialog);

    act(() => {
      root.render(
        <Dialog open={true} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    expect(dialog.showModal).toHaveBeenCalled();
  });

  it('calls dialog.close when open becomes false', () => {
    // Start open
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    patchDialog(dialog);

    act(() => {
      root.render(
        <Dialog open={true} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    expect(dialog.showModal).toHaveBeenCalled();

    onCloseMock.mockClear();
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    expect(dialog.close).toHaveBeenCalled();
  });

  it('renders a close button', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    const closeBtn = container.querySelector('button[aria-label="Close"]');
    expect(closeBtn).not.toBeNull();
  });

  it('triggers exit animation on close button click', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    patchDialog(dialog);

    // Open the dialog
    act(() => {
      root.render(
        <Dialog open={true} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });

    const closeBtn = container.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    act(() => { closeBtn.click(); });

    // The closing class should be applied
    expect(dialog.className).toContain('modal--closing');

    // After the timeout fallback, onClose should be called
    act(() => { vi.advanceTimersByTime(300); });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('renders resize handles on desktop', () => {
    // Default window.innerWidth > 820 so not mobile
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    const resizeHandles = container.querySelectorAll('.resizeHandle--right, .resizeHandle--bottom');
    const resizeCorner = container.querySelector('.resizeCorner');
    expect(resizeHandles.length).toBe(2);
    expect(resizeCorner).not.toBeNull();
  });

  it('applies inline width/height styles on desktop', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    const card = container.querySelector('.modal__card') as HTMLElement;
    expect(card?.style.width).toBe('600px');
    expect(card?.style.height).toBe('480px');
  });

  it('renders all three size variants', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      act(() => {
        root.render(
          <Dialog open={false} onClose={onCloseMock} title="Test" size={size}>
            <p>Body</p>
          </Dialog>
        );
      });
      const dialog = container.querySelector('dialog');
      expect(dialog?.className).toContain(`modal--${size}`);
    }
  });

  it('calls onClose when dialog native close event fires', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;

    // Simulate native close event (e.g. from pressing Escape)
    act(() => {
      dialog.dispatchEvent(new Event('close'));
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('handles backdrop click to close', () => {
    act(() => {
      root.render(
        <Dialog open={false} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    patchDialog(dialog);

    // Open the dialog
    act(() => {
      root.render(
        <Dialog open={true} onClose={onCloseMock} title="Test">
          <p>Body</p>
        </Dialog>
      );
    });
    onCloseMock.mockClear();

    // Click on the dialog itself (backdrop)
    act(() => {
      dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // The closing animation should trigger
    act(() => { vi.advanceTimersByTime(300); });
    expect(onCloseMock).toHaveBeenCalled();
  });
});

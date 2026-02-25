/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const onCloseMock = vi.fn();
const executeMock = vi.fn(async () => ({ text: 'AI response', provider: 'test', latencyMs: 100 }));
const destroyMock = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: { projectType: 'book' },
    activeChapter: {
      id: 'c1',
      title: 'Test Chapter',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Some chapter text here.' }] }] },
    },
  }),
}));

vi.mock('@/lib/ai', () => ({
  loadAIConfig: () => ({ provider: 'openai-compatible', endpoint: 'https://test/v1', sessionToken: 'tok', model: 'gpt-test' }),
  createProvider: () => ({ execute: executeMock, destroy: destroyMock, isAvailable: () => true }),
}));

let idCounter = 0;
vi.mock('@/lib/utils', () => ({
  editorToPlainText: () => 'Some chapter text here.',
  generateId: () => 'test-id-' + String(++idCounter),
}));

vi.mock('@/lib/telemetry', () => ({
  recordTelemetryEvent: vi.fn(),
  isTelemetryOptedIn: () => false,
}));

vi.mock('./Panels.module.css', () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { AISuggestionsPanel } from './AISuggestionsPanel';

describe('AISuggestionsPanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    onCloseMock.mockClear();
    executeMock.mockClear();
    destroyMock.mockClear();
    idCounter = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('returns null when not open', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<AISuggestionsPanel open={false} onClose={onCloseMock} editor={null} />);
    });

    expect(container.innerHTML).toBe('');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders panel with header when open', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<AISuggestionsPanel open={true} onClose={onCloseMock} editor={null} />);
    });

    expect(container.textContent).toContain('AI Suggestions');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows three collapsible sections', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<AISuggestionsPanel open={true} onClose={onCloseMock} editor={null} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('Quick Actions');
    expect(text).toContain('Rewrite Tools');
    expect(text).toContain('Brainstorm');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows rewrite disabled hint when no selection', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<AISuggestionsPanel open={true} onClose={onCloseMock} editor={null} />);
    });

    expect(container.textContent).toContain('Select text in the editor to use rewrite tools');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows quick action buttons', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<AISuggestionsPanel open={true} onClose={onCloseMock} editor={null} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const labels = buttons.map(b => b.textContent || '');

    const expected = ['Continue', 'Rephrase', 'Strengthen', 'Shorten'];
    for (const label of expected) {
      expect(labels.some(l => l.includes(label))).toBe(true);
    }

    await act(async () => {
      root.unmount();
    });
  });

  it('shows brainstorm buttons', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<AISuggestionsPanel open={true} onClose={onCloseMock} editor={null} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const labels = buttons.map(b => b.textContent || '');

    const expected = ['Plot Ideas', 'Character Arc', 'Scene Outline', 'What If...'];
    for (const label of expected) {
      expect(labels.some(l => l.includes(label))).toBe(true);
    }

    await act(async () => {
      root.unmount();
    });
  });

  it('clicking quick action calls AI provider', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<AISuggestionsPanel open={true} onClose={onCloseMock} editor={null} />);
    });

    const continueBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent === 'edit_noteContinue'
    );
    expect(continueBtn).toBeTruthy();

    await act(async () => {
      continueBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'continue',
        projectType: 'book',
        sectionTitle: 'Test Chapter',
      })
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('close button calls onClose', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<AISuggestionsPanel open={true} onClose={onCloseMock} editor={null} />);
    });

    const closeBtn = container.querySelector('button[aria-label="Close panel"]');
    expect(closeBtn).toBeTruthy();

    await act(async () => {
      closeBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onCloseMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});

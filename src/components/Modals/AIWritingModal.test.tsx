/** @vitest-environment jsdom */
import { act, type ChangeEventHandler, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const executeMock = vi.fn(async () => ({ text: 'generated output' }));
const destroyMock = vi.fn();

vi.mock('@/components/UI', () => ({
  Dialog: ({ open, title, footer, children }: { open: boolean; title: string; footer?: ReactNode; children?: ReactNode }) => open ? <div><h1>{title}</h1>{children}{footer}</div> : null,
  Button: ({ children, onClick, disabled }: { children?: ReactNode; onClick?: () => void; disabled?: boolean }) => <button onClick={onClick} disabled={disabled}>{children}</button>,
  Input: ({ value, onChange, placeholder }: { value?: string; onChange?: ChangeEventHandler<HTMLInputElement>; placeholder?: string }) => <input value={value} onChange={onChange} placeholder={placeholder} />,
  Textarea: ({ value, onChange, placeholder }: { value?: string; onChange?: ChangeEventHandler<HTMLTextAreaElement>; placeholder?: string }) => <textarea value={value} onChange={onChange} placeholder={placeholder} />,
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: { projectType: 'book', chapters: [], novelId: 'novel-1', storyBlueprint: null },
    activeChapter: {
      id: 'chapter-1',
      title: 'Opening',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Context paragraph' }] }] },
    },
  }),
}));

vi.mock('@/lib/ai', () => ({
  loadAIConfig: () => ({
    provider: 'openai-compatible',
    endpoint: 'https://example.ai/v1/chat/completions',
    sessionToken: 'secret',
    model: 'gpt-test',
  }),
  saveAIConfig: vi.fn(),
  createProvider: () => ({ execute: executeMock, destroy: destroyMock }),
  isChromeAIAvailable: vi.fn(async () => false),
  checkChromeAIAvailability: vi.fn(async () => ({ writer: 'unavailable' })),
  detectBestProvider: vi.fn(async () => 'openai-compatible'),
  isChromeBrowser: vi.fn(() => false),
  SERVER_PROXY_ENDPOINTS: { groq: 'https://groq', openrouter: 'https://openrouter', gemini: 'https://gemini' },
  SERVER_PROXY_MODELS: { groq: [{ id: 'g', label: 'g' }], openrouter: [{ id: 'o', label: 'o' }], gemini: [{ id: 'm', label: 'm' }] },
  SERVER_PROXY_LABELS: { groq: 'Groq', openrouter: 'OpenRouter', gemini: 'Gemini' },
}));

vi.mock('@/lib/featureFlags', () => ({
  getBrokerBaseUrl: () => '',
  getBrokerEndpoint: (path: string) => path,
}));

import { AIWritingModal } from './AIWritingModal';

describe('AIWritingModal action handling', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    executeMock.mockClear();
    destroyMock.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('sends the expected preset action and chapter context', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<AIWritingModal open onClose={() => undefined} />);
    });

    const presetButton = Array.from(container.querySelectorAll('button')).find(node => node.textContent?.includes('Continue Writing'));
    expect(presetButton).toBeTruthy();

    await act(async () => {
      presetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      action: 'continue',
      sectionTitle: 'Opening',
      projectType: 'book',
    }));
    expect(executeMock).toHaveBeenCalled();
    expect(destroyMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});

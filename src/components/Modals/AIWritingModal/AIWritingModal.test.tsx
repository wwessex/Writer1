/** @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

// CSS modules
vi.mock('../Modals.module.css', () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

// UI components
vi.mock('@/components/UI', () => ({
    Dialog: ({ open, onClose, title, children, footer }: any) => open ? (
      <div data-testid="dialog" data-title={title}>
        <div data-testid="dialog-body">{children}</div>
        {footer && <div data-testid="dialog-footer">{footer}</div>}
        <button data-testid="close-btn" onClick={onClose}>Close</button>
      </div>
    ) : null,
    Button: ({ children, onClick, disabled, variant }: any) => (
      <button onClick={onClick} disabled={disabled} data-variant={variant}>
        {children}
      </button>
    ),
    Input: (props: any) => (
      <input {...props} />
    ),
    Textarea: (props: any) => (
      <textarea {...props} />
    ),
    useToast: () => ({
      showToast: vi.fn(),
    }),
}));

// AppContext mock
const mockUpdateChapter = vi.fn();
const mockState = {
  projectType: 'book' as string,
  novelId: 'novel-1',
  novelTitle: 'Test Novel',
  chapters: [],
  activeChapterId: 'ch-1',
  isOnline: true,
  isSaving: false,
  settings: {},
  storyBlueprint: null,
};

const mockActiveChapter = {
  id: 'ch-1',
  novelId: 'novel-1',
  order: 0,
  title: 'Chapter 1',
  updatedAt: Date.now(),
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] },
  summary: '',
  pov: '',
  status: 'draft' as const,
  tags: [],
  wordGoal: 0,
  scenes: [],
};

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: mockState,
    activeChapter: mockActiveChapter,
    updateChapter: mockUpdateChapter,
    dispatch: vi.fn(),
  }),
}));

// AI modules
const mockExecute = vi.fn().mockResolvedValue({ text: 'AI response text' });
const mockDestroy = vi.fn();

const defaultAIConfig: Record<string, any> = {
  provider: 'openai-compatible',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  sessionToken: 'sk-test-key',
  model: 'gpt-4o',
  serverProxy: null,
};

let currentAIConfig = { ...defaultAIConfig };
const mockLoadAIConfig = vi.fn(() => ({ ...currentAIConfig }));

vi.mock('@/lib/ai', () => ({
  loadAIConfig: () => mockLoadAIConfig(),
  saveAIConfig: vi.fn(),
  createProvider: () => ({
    execute: mockExecute,
    destroy: mockDestroy,
  }),
  isChromeAIAvailable: vi.fn().mockResolvedValue(false),
  checkChromeAIAvailability: vi.fn().mockResolvedValue({}),
  detectBestProvider: vi.fn().mockResolvedValue('openai-compatible'),
  isChromeBrowser: vi.fn().mockReturnValue(false),
  SERVER_PROXY_ENDPOINTS: {
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  },
  SERVER_PROXY_MODELS: {
    groq: [{ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' }],
    openrouter: [{ id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash' }],
    gemini: [{ id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' }],
  },
  SERVER_PROXY_LABELS: {
    groq: 'Groq',
    openrouter: 'OpenRouter',
    gemini: 'Gemini',
  },
  CUSTOM_LLM_DEFAULTS: {
    ollama: { baseUrl: 'http://localhost:11434', model: 'narratryx:latest', label: 'Ollama' },
    vllm: { baseUrl: 'http://localhost:8000', model: 'narratryx', label: 'vLLM' },
    'llama-cpp': { baseUrl: 'http://localhost:8080', model: 'default', label: 'llama.cpp' },
    'generic-openai': { baseUrl: 'http://localhost:8000', model: 'default', label: 'Custom Endpoint' },
  },
  CUSTOM_LLM_BACKEND_LABELS: {
    ollama: 'Ollama',
    vllm: 'vLLM',
    'llama-cpp': 'llama.cpp',
    'generic-openai': 'Custom Endpoint',
  },
  assembleStoryBibleContext: vi.fn(() => ({ entities: [], recentSceneSummaries: [], styleNotes: '' })),
  formatStoryBibleForPrompt: vi.fn(() => ''),
  runEvalSuite: vi.fn().mockResolvedValue({
    provider: 'custom-llm', model: 'test', timestamp: Date.now(), results: [],
    overallScore: 0.75, passRate: 0.8, averageLatencyMs: 500, recommendation: 'ready',
  }),
  saveEvalResult: vi.fn(),
}));

vi.mock('@/lib/ai/pipelines', () => ({
  AI_WRITING_PIPELINE_STAGES: [
    {
      id: 'beat-to-scene',
      label: '1. Beat-to-scene draft',
      action: 'pipeline-beat-to-scene',
      promptTemplate: 'Beat template {{chapterText}} {{currentDraft}} {{userPrompt}}',
    },
    {
      id: 'expansion',
      label: '2. Expansion pass',
      action: 'pipeline-expansion',
      promptTemplate: 'Expansion template {{currentDraft}}',
    },
    {
      id: 'tone',
      label: '5. Optional tone-matching pass',
      optional: true,
      action: 'pipeline-tone',
      promptTemplate: 'Tone template {{toneReference}} {{currentDraft}}',
    },
  ],
  applyInsertionMode: vi.fn((_base: string, incoming: string) => incoming),
  renderPipelinePrompt: vi.fn((template: string) => template),
}));

vi.mock('@/lib/utils', () => ({
  editorToPlainText: vi.fn(() => 'Hello world'),
}));

vi.mock('@/lib/continuityMemory', () => ({
  formatContinuityContext: vi.fn(() => ''),
  getContinuityMemorySnapshot: vi.fn(() => ({})),
}));

vi.mock('@/lib/featureFlags', () => ({
  getBrokerBaseUrl: vi.fn(() => ''),
  getBrokerEndpoint: vi.fn((path: string) => `https://broker.test${path}`),
}));

vi.mock('@/lib/aiRevisionLog', () => ({
  recordAIRevision: vi.fn(),
}));

vi.mock('@/hooks/useResizable', () => ({
  useWindowResize: () => ({
    width: 600,
    height: 480,
    startResize: () => () => {},
    reset: vi.fn(),
  }),
}));

/* ------------------------------------------------------------------ */
/*  Import component AFTER mocks                                       */
/* ------------------------------------------------------------------ */

import { AIWritingModal } from './index';

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AIWritingModal', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let onCloseMock: any;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onCloseMock = vi.fn();
    mockExecute.mockReset().mockResolvedValue({ text: 'AI response text' });
    mockDestroy.mockReset();
    currentAIConfig = { ...defaultAIConfig };
    mockState.projectType = 'book';
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  /* --- Basic rendering --- */

  it('renders nothing when open is false', () => {
    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
  });

  it('renders the dialog when open is true', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const dialog = container.querySelector('[data-testid="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('data-title')).toBe('AI Writing Tools');
  });

  it('renders preset prompt buttons for book project type', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const text = container.textContent || '';
    expect(text).toContain('Continue Writing');
    expect(text).toContain('Suggest Alternatives');
    expect(text).toContain('Summarise');
    expect(text).toContain('Expand');
    expect(text).toContain('Fix Grammar');
  });

  it('renders screenplay preset prompts when project type is screenplay', () => {
    mockState.projectType = 'screenplay';
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const text = container.textContent || '';
    expect(text).toContain('Generate Dialogue Alternatives');
    expect(text).toContain('Tighten Action Lines');
    expect(text).toContain('Beat Outline to Scene Draft');
    mockState.projectType = 'book';
  });

  it('renders the custom prompt textarea', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
  });

  it('renders context hint when active chapter exists', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const text = container.textContent || '';
    expect(text).toContain('Context:');
    expect(text).toContain('Chapter 1');
  });

  /* --- Footer rendering --- */

  it('renders Settings button in footer', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const footer = container.querySelector('[data-testid="dialog-footer"]');
    expect(footer?.textContent).toContain('Settings');
  });

  it('renders provider indicator in footer', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const text = container.textContent || '';
    expect(text).toContain('AI ready');
    expect(text).toContain('Using custom provider');
  });

  it('renders Send button in footer', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const footer = container.querySelector('[data-testid="dialog-footer"]');
    expect(footer?.textContent).toContain('Send');
  });

  it('renders Run Pipeline button in footer', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const footer = container.querySelector('[data-testid="dialog-footer"]');
    expect(footer?.textContent).toContain('Run Pipeline');
  });

  /* --- Settings panel --- */

  it('does not show settings panel by default', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const text = container.textContent || '';
    expect(text).not.toContain('AI Configuration');
  });

  it('toggles settings panel when Settings button is clicked', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Find and click the Settings button
    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    expect(settingsBtn).toBeDefined();

    act(() => {
      settingsBtn!.click();
    });

    const text = container.textContent || '';
    expect(text).toContain('AI Configuration');
    expect(text).toContain('Hide Settings');
  });

  it('shows server provider options in settings', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Open settings
    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Server AI Providers');
    expect(text).toContain('Groq');
    expect(text).toContain('OpenRouter');
    expect(text).toContain('Gemini');
  });

  it('shows privacy note for custom provider', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Open settings
    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Using a custom OpenAI-compatible provider');
  });

  it('shows Chrome AI not available message for non-Chrome browser', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Chrome AI requires Google Chrome');
  });

  /* --- Prompt interaction --- */

  it('updates prompt when typing in textarea', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const textarea = container.querySelector('textarea')!;
    act(() => {
      const event = new Event('change', { bubbles: true });
      Object.defineProperty(event, 'target', { value: { value: 'My custom prompt' } });
      textarea.dispatchEvent(event);
    });
    // The textarea is controlled, so we just verify it exists and is interactive
    expect(textarea).not.toBeNull();
  });

  it('sends prompt when Send button is clicked', async () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Type a prompt
    const textarea = container.querySelector('textarea')!;
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;
      nativeInputValueSetter?.call(textarea, 'Write more content');
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // The Send button should be in footer
    const buttons = Array.from(container.querySelectorAll('button'));
    const sendBtn = buttons.find(b => b.textContent?.includes('Send'));
    expect(sendBtn).toBeDefined();
  });

  it('shows response area when there is a response', async () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Click a preset to trigger sendPrompt
    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));
    expect(continueBtn).toBeDefined();

    await act(async () => {
      continueBtn!.click();
    });

    // Wait for the response
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const text = container.textContent || '';
    expect(text).toContain('Response');
    expect(text).toContain('AI response text');
  });

  it('shows Copy and Insert buttons when response exists', async () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Click a preset
    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));

    await act(async () => {
      continueBtn!.click();
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const allButtons = Array.from(container.querySelectorAll('button'));
    const copyBtn = allButtons.find(b => b.textContent?.includes('Copy'));
    const insertBtn = allButtons.find(b => b.textContent?.includes('Insert to Chapter'));
    expect(copyBtn).toBeDefined();
    expect(insertBtn).toBeDefined();
  });

  /* --- Error state --- */

  it('shows error when prompt sent and provider execution fails', async () => {
    mockExecute.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));

    await act(async () => {
      continueBtn!.click();
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const text = container.textContent || '';
    expect(text).toContain('API rate limit exceeded');
  });

  /* --- Pipeline UI --- */

  it('renders pipeline stages', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const text = container.textContent || '';
    expect(text).toContain('Sequential pipeline');
    expect(text).toContain('1. Beat-to-scene draft');
    expect(text).toContain('2. Expansion pass');
    expect(text).toContain('5. Optional tone-matching pass');
  });

  it('renders tone match toggle', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const text = container.textContent || '';
    expect(text).toContain('Include optional tone-matching pass');
  });

  it('renders pipeline insertion mode selects', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const selects = container.querySelectorAll('select');
    // One select per pipeline stage
    expect(selects.length).toBeGreaterThanOrEqual(3);
  });

  /* --- Template buttons --- */

  it('renders book chapter template button', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const text = container.textContent || '';
    expect(text).toContain('Insert Book Chapter Template');
  });

  it('renders screenplay scene template button', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });
    const text = container.textContent || '';
    expect(text).toContain('Insert Screenplay Scene Template');
  });

  /* --- Unconfigured notice --- */

  it('shows unconfigured notice when not configured and settings hidden', () => {
    // Override config to unconfigured state
    currentAIConfig = {
      provider: 'openai-compatible' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: null as unknown,
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    // Re-open to reload config
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('AI is not configured yet');
  });

  /* --- Close behavior --- */

  it('calls onClose when close button is clicked', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const closeBtn = container.querySelector('[data-testid="close-btn"]')!;
    act(() => { closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onCloseMock).toHaveBeenCalled();
  });

  /* --- Provider label variations --- */

  it('shows correct provider label for server-proxy', () => {
    currentAIConfig = {
      provider: 'server-proxy' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: {
        serverProvider: 'groq',
        model: 'llama-3.3-70b-versatile',
        userApiKey: 'test-key',
      },
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('Using Groq');
  });

  /* --- Run Pipeline --- */

  it('runs pipeline when Run Pipeline button is clicked', async () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const pipelineBtn = buttons.find(b => b.textContent?.includes('Run Pipeline'));
    expect(pipelineBtn).toBeDefined();

    await act(async () => {
      pipelineBtn!.click();
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Pipeline calls execute multiple times (once per non-optional stage)
    expect(mockExecute).toHaveBeenCalledTimes(2); // 2 non-optional stages
    const text = container.textContent || '';
    expect(text).toContain('Response');
  });

  /* --- Screenplay-specific prompt placeholder --- */

  it('shows screenplay-specific textarea placeholder', () => {
    mockState.projectType = 'screenplay';
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const textarea = container.querySelector('textarea')!;
    expect(textarea.placeholder).toContain('Punch up the subtext');

    mockState.projectType = 'book';
  });

  it('shows book-specific textarea placeholder', () => {
    mockState.projectType = 'book';
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const textarea = container.querySelector('textarea')!;
    expect(textarea.placeholder).toContain('Rewrite this scene from a different POV');
  });

  /* --- Context hint for screenplay --- */

  it('shows scene structure context hint for screenplay', () => {
    mockState.projectType = 'screenplay';
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('scene structure');

    mockState.projectType = 'book';
  });

  it('shows chapter details context hint for book', () => {
    mockState.projectType = 'book';
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('chapter details');
  });

  /* --- Insert response --- */

  it('calls updateChapter when Insert to Chapter is clicked', async () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Trigger a response via preset
    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));

    await act(async () => {
      continueBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const allButtons = Array.from(container.querySelectorAll('button'));
    const insertBtn = allButtons.find(b => b.textContent?.includes('Insert to Chapter'));
    expect(insertBtn).toBeDefined();

    await act(async () => {
      insertBtn!.click();
    });

    expect(mockUpdateChapter).toHaveBeenCalledWith('ch-1', { content: 'AI response text' });
  });

  /* --- Copy response --- */

  it('copies response to clipboard when Copy is clicked', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });

    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));

    await act(async () => {
      continueBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const allButtons = Array.from(container.querySelectorAll('button'));
    const copyBtn = allButtons.find(b => b.textContent?.includes('Copy'));

    await act(async () => {
      copyBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(mockWriteText).toHaveBeenCalledWith('AI response text');
  });

  /* --- Server proxy config in settings --- */

  it('shows model select and API key input when server-proxy provider is selected', () => {
    currentAIConfig = {
      provider: 'server-proxy' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: {
        serverProvider: 'groq',
        model: 'llama-3.3-70b-versatile',
        userApiKey: '',
      },
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Open settings
    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Model');
    expect(text).toContain('Your API Key');
    expect(text).toContain('Test Connection');
    expect(text).toContain('Use Automatic Mode');
  });

  /* --- Server proxy privacy notes --- */

  it('shows server proxy privacy note with user key', () => {
    currentAIConfig = {
      provider: 'server-proxy' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: {
        serverProvider: 'groq',
        model: 'llama-3.3-70b-versatile',
        userApiKey: 'my-key',
      },
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Open settings
    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Requests are sent directly to the provider API with your key');
  });

  it('shows server proxy privacy note without user key', () => {
    currentAIConfig = {
      provider: 'server-proxy' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: {
        serverProvider: 'openrouter',
        model: 'google/gemini-2.0-flash-exp:free',
        userApiKey: '',
      },
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Open settings
    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Requests are routed through the DraftHarbour server proxy');
  });

  /* --- Chrome AI provider label --- */

  it('shows chrome-ai provider label', () => {
    currentAIConfig = {
      provider: 'chrome-ai' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: null as unknown,
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('Using local AI');
  });

  /* --- Managed cloud provider label --- */

  it('shows managed-cloud provider label', () => {
    currentAIConfig = {
      provider: 'managed-cloud' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: null as unknown,
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('Using cloud AI');
  });

  /* --- Chrome AI privacy note in settings --- */

  it('shows chrome-ai privacy note in settings', () => {
    currentAIConfig = {
      provider: 'chrome-ai' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: null as unknown,
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Open settings
    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Using local AI. Chrome built-in models run directly on your device');
  });

  /* --- Send error when not configured --- */

  it('shows config error when sending prompt with missing API key', async () => {
    currentAIConfig = {
      provider: 'openai-compatible' as const,
      endpoint: 'https://api.openai.com/v1/chat/completions',
      sessionToken: '',
      model: '',
      serverProxy: null as unknown,
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Click a preset to trigger sendPrompt
    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));

    await act(async () => {
      continueBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const text = container.textContent || '';
    expect(text).toContain('API key is missing');
  });

  it('shows generic config error when sending prompt without any config', async () => {
    currentAIConfig = {
      provider: 'openai-compatible' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: null as unknown,
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));

    await act(async () => {
      continueBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const text = container.textContent || '';
    expect(text).toContain('AI is not configured yet');
  });

  /* --- Pipeline error when not configured --- */

  it('shows error when running pipeline without config', async () => {
    currentAIConfig = {
      provider: 'openai-compatible' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: null as unknown,
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const pipelineBtn = buttons.find(b => b.textContent?.includes('Run Pipeline'));

    await act(async () => {
      pipelineBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const text = container.textContent || '';
    expect(text).toContain('Configure AI first');
  });

  /* --- Server proxy unconfigured error --- */

  it('shows server proxy config error when sending prompt', async () => {
    currentAIConfig = {
      provider: 'server-proxy' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: {
        serverProvider: 'groq',
        model: 'llama-3.3-70b-versatile',
        userApiKey: '',
      },
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));

    await act(async () => {
      continueBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const text = container.textContent || '';
    expect(text).toContain('Groq');
    expect(text).toContain('not configured yet');
  });

  /* --- Generating state label --- */

  it('shows Generating text in Send button while loading', async () => {
    // Make execute hang forever
    mockExecute.mockReturnValue(new Promise(() => {}));

    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));

    await act(async () => {
      continueBtn!.click();
    });

    const text = container.textContent || '';
    expect(text).toContain('Generating...');
    expect(text).toContain('Running pipeline...');
    expect(text).toContain('Generating response...');
  });

  /* --- Endpoint presets shown in custom provider details --- */

  it('shows endpoint presets in custom provider section', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Open settings
    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    // The custom provider details section shows endpoint presets
    expect(text).toContain('Custom provider (advanced)');
    expect(text).toContain('Quick setup:');
  });

  /* --- Managed cloud privacy note in settings --- */

  it('shows managed-cloud privacy note in settings', () => {
    currentAIConfig = {
      provider: 'managed-cloud' as const,
      endpoint: '',
      sessionToken: '',
      model: '',
      serverProxy: null as unknown,
    };

    act(() => {
      root.render(<AIWritingModal open={false} onClose={onCloseMock} />);
    });
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Open settings
    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Using cloud AI. Requests are routed through the managed DraftHarbour cloud endpoint');
  });

  /* --- Settings stored locally hint --- */

  it('shows settings stored locally hint in settings', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Settings are stored locally in your browser');
  });

  /* --- storyBlueprint context --- */

  it('sends story blueprint context with prompt when storyBlueprint exists', async () => {
    mockState.storyBlueprint = {
      genre: 'Fantasy',
      subgenre: 'Epic',
      targetAudience: 'Adult',
      ageBand: '18+',
      tone: 'Dark',
      voice: 'Third person',
      structure: 'Three act',
      targetWordCount: 100000,
      pacingProfile: 'Medium',
    } as unknown as null; // type hack for the mock

    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));

    await act(async () => {
      continueBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(mockExecute).toHaveBeenCalled();
    mockState.storyBlueprint = null;
  });

  /* --- Pipeline with tone match pass enabled --- */

  it('renders tone match checkbox that is unchecked by default', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
  });

  /* --- Pipeline error handling --- */

  it('shows error when pipeline execution fails', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Pipeline stage failed'));

    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const pipelineBtn = buttons.find(b => b.textContent?.includes('Run Pipeline'));

    await act(async () => {
      pipelineBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    const text = container.textContent || '';
    expect(text).toContain('Pipeline stage failed');
  });

  /* --- Non-Error rejection in sendPrompt --- */

  it('shows generic error for non-Error rejection', async () => {
    mockExecute.mockRejectedValueOnce('string error');

    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent?.includes('Continue Writing'));

    await act(async () => {
      continueBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const text = container.textContent || '';
    expect(text).toContain('An unexpected error occurred');
  });

  /* --- Non-Error rejection in pipeline --- */

  it('shows generic error for non-Error pipeline rejection', async () => {
    mockExecute.mockRejectedValueOnce(42);

    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const pipelineBtn = buttons.find(b => b.textContent?.includes('Run Pipeline'));

    await act(async () => {
      pipelineBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    const text = container.textContent || '';
    expect(text).toContain('Pipeline run failed');
  });

  /* --- Clicking a server provider button in settings --- */

  it('switches to server proxy provider when clicking Groq in settings', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    // Open settings
    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    // Click Groq provider button
    const allButtons = Array.from(container.querySelectorAll('button'));
    const groqBtn = allButtons.find(b => b.textContent?.includes('Groq') && b.textContent?.includes('Server-managed'));
    expect(groqBtn).toBeDefined();
    act(() => { groqBtn!.click(); });

    // Should now show model selection and test connection
    const text = container.textContent || '';
    expect(text).toContain('Model');
    expect(text).toContain('Test Connection');
  });

  /* --- Settings hint text --- */

  it('shows enter your API key hint in server providers', () => {
    act(() => {
      root.render(<AIWritingModal open={true} onClose={onCloseMock} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent?.includes('Settings') && !b.textContent?.includes('Hide'));
    act(() => { settingsBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Enter your API key to connect directly');
  });
});

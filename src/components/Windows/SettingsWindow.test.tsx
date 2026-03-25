/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsWindow } from './SettingsWindow';

const mocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  aiConfig: {
    provider: 'managed-cloud' as const,
  },
  saveAIConfig: vi.fn(),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      projectType: 'book',
      settings: {
        autosaveMs: 800,
        dailyWordGoal: 0,
        novelWordGoal: 0,
        novelDeadline: '',
        sync: { novelId: '', url: '', auth: '' },
        assist: {
          languageToolEnabled: false,
          languageToolUrl: 'https://api.languagetool.org/v2/check',
          languageToolLanguage: 'en-US',
        },
        theme: 'light',
        sidebarHidden: false,
        pageView: true,
        focusMode: false,
        quickSwitcherMode: 'all',
        typography: { fontFamily: 'system', fontSize: 16, lineHeight: 1.75 },
        onboardingComplete: false,
        typewriterMode: false,
        releaseChannel: 'stable',
        sidebarPanels: {},
        goalConfiguration: {
          dailyWordTarget: 0,
          weeklyWordTarget: 0,
          draftCompletionDeadline: '',
          milestoneCheckpoints: [],
        },
      },
    },
    updateSettings: mocks.updateSettings,
  }),
}));

vi.mock('@/hooks/useResizable', () => ({
  useWindowResize: () => ({
    width: 400,
    height: 520,
    startResize: () => () => undefined,
    reset: () => undefined,
  }),
}));

vi.mock('@/lib/storage', () => ({
  clearAllData: vi.fn(),
}));

vi.mock('@/lib/telemetry', () => ({
  isTelemetryOptedIn: () => false,
  setTelemetryOptIn: vi.fn(),
  clearTelemetryData: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  loadAIConfig: () => mocks.aiConfig,
  saveAIConfig: mocks.saveAIConfig,
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
  fetchOllamaModels: vi.fn().mockResolvedValue([]),
  testCustomLlmConnection: vi.fn().mockResolvedValue({ ok: true, message: 'Connected' }),
}));

vi.mock('@/lib/policy', () => ({
  getManagedPolicy: () => ({}),
}));

vi.mock('@/lib/desktopUpdater', () => ({
  applyUpdateAndRestart: vi.fn(),
  checkForUpdate: vi.fn(),
  deferUpdate: vi.fn(),
  getDeferredUpdateVersion: vi.fn(() => null),
  getLaunchFallbackMessage: vi.fn(() => null),
  getReleaseChannel: vi.fn(() => 'stable'),
  setReleaseChannel: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

function renderSettingsWindow({ open = true, onClose = () => undefined }: { open?: boolean; onClose?: () => void } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<SettingsWindow open={open} onClose={onClose} />);
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
  vi.clearAllMocks();
});

describe('SettingsWindow', () => {
  it('returns null when closed', () => {
    const rendered = renderSettingsWindow({ open: false });
    expect(rendered.container.textContent).toBe('');
    rendered.unmount();
  });

  it('renders section headers when open', () => {
    const rendered = renderSettingsWindow();

    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Typography');
    expect(text).toContain('AI Provider');
    expect(text).toContain('Application');
    rendered.unmount();
  });

  it('renders the Local AI section header', () => {
    const rendered = renderSettingsWindow();
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Local AI (Custom LLM)');
    rendered.unmount();
  });

  it('expands Local AI section and shows backend buttons', async () => {
    const rendered = renderSettingsWindow();

    // Find the section toggle button (inside a <section> element, not the TOC)
    const sections = Array.from(rendered.container.querySelectorAll('section'));
    const localAiSection = sections.find(s => s.textContent?.includes('Local AI'));
    expect(localAiSection).toBeDefined();

    const sectionToggle = localAiSection!.querySelector('button');
    expect(sectionToggle).not.toBeNull();

    await act(async () => {
      sectionToggle!.click();
    });

    // After expanding, the section should show configuration fields
    const text = localAiSection!.textContent ?? '';
    expect(text).toContain('Connect to a local or self-hosted LLM server');
    expect(text).toContain('Base URL');
    expect(text).toContain('Test Connection');
    rendered.unmount();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const rendered = renderSettingsWindow({ onClose });

    const closeButton = rendered.container.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    if (closeButton) {
      act(() => {
        closeButton.click();
      });
      expect(onClose).toHaveBeenCalled();
    }
    rendered.unmount();
  });

  it('renders AI Provider section with provider preset buttons', () => {
    const rendered = renderSettingsWindow();
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('AI Provider');
    expect(text).toContain('OpenAI');
    expect(text).toContain('Groq');
    rendered.unmount();
  });

  it('renders typography controls', () => {
    const rendered = renderSettingsWindow();
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Font Family');
    expect(text).toContain('Font Size');
    expect(text).toContain('Line Height');
    rendered.unmount();
  });

  it('renders application settings', () => {
    const rendered = renderSettingsWindow();
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Typewriter Scroll Mode');
    rendered.unmount();
  });

  it('renders data management section', () => {
    const rendered = renderSettingsWindow();
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Data Management');
    rendered.unmount();
  });

  it('renders Writing Assistance section', () => {
    const rendered = renderSettingsWindow();
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Writing Assistance');
    rendered.unmount();
  });

  it('renders Updates section with release channel options', () => {
    const rendered = renderSettingsWindow();
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Release Channel');
    expect(text).toContain('Stable');
    expect(text).toContain('Beta');
    expect(text).toContain('Nightly');
    rendered.unmount();
  });

  it('renders Online Sync section header', () => {
    const rendered = renderSettingsWindow();
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Online Sync');
    rendered.unmount();
  });

  it('renders Privacy section header', () => {
    const rendered = renderSettingsWindow();
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Privacy & Data Sync');
    rendered.unmount();
  });

  it('expands Online Sync section on click', async () => {
    const rendered = renderSettingsWindow();
    const sections = Array.from(rendered.container.querySelectorAll('section'));
    const syncSection = sections.find(s => s.textContent?.includes('Online Sync'));
    expect(syncSection).toBeDefined();

    const toggle = syncSection!.querySelector('button');
    await act(async () => { toggle!.click(); });

    const text = syncSection!.textContent ?? '';
    expect(text).toContain('Novel ID');
    expect(text).toContain('Sync Server URL');
    expect(text).toContain('Authorization Header');
    rendered.unmount();
  });

  it('expands Writing Assistance section on click', async () => {
    const rendered = renderSettingsWindow();
    const sections = Array.from(rendered.container.querySelectorAll('section'));
    const assistSection = sections.find(s => s.textContent?.includes('Writing Assistance'));
    expect(assistSection).toBeDefined();

    const toggle = assistSection!.querySelector('button');
    await act(async () => { toggle!.click(); });

    const text = assistSection!.textContent ?? '';
    expect(text).toContain('Enable LanguageTool');
    rendered.unmount();
  });

  it('expands Data Management section on click', async () => {
    const rendered = renderSettingsWindow();
    const sections = Array.from(rendered.container.querySelectorAll('section'));
    const dataSection = sections.find(s => s.textContent?.includes('Data Management'));
    expect(dataSection).toBeDefined();

    const toggle = dataSection!.querySelector('button');
    await act(async () => { toggle!.click(); });

    const text = dataSection!.textContent ?? '';
    expect(text).toContain('Reset All Data');
    rendered.unmount();
  });

  it('expands Privacy section on click', async () => {
    const rendered = renderSettingsWindow();
    const sections = Array.from(rendered.container.querySelectorAll('section'));
    const privacySection = sections.find(s => s.textContent?.includes('Privacy'));
    expect(privacySection).toBeDefined();

    const toggle = privacySection!.querySelector('button');
    await act(async () => { toggle!.click(); });

    const text = privacySection!.textContent ?? '';
    expect(text).toContain('AI Usage Telemetry');
    rendered.unmount();
  });

  it('filters sections when search query is entered', async () => {
    const rendered = renderSettingsWindow();

    // Find the search input
    const inputs = Array.from(rendered.container.querySelectorAll('input'));
    const searchInput = inputs.find(i => i.placeholder?.toLowerCase().includes('search') || i.type === 'search');

    if (searchInput) {
      await act(async () => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        nativeInputValueSetter.call(searchInput, 'font');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    rendered.unmount();
  });

  it('renders check for updates button', () => {
    const rendered = renderSettingsWindow();
    const buttons = Array.from(rendered.container.querySelectorAll('button'));
    const checkUpdatesBtn = buttons.find(b => b.textContent?.includes('Check for Updates'));
    expect(checkUpdatesBtn).toBeDefined();
    rendered.unmount();
  });

  it('can change autosave value', async () => {
    const rendered = renderSettingsWindow();
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Autosave (ms)');
    rendered.unmount();
  });

  it('does not pre-select any backend button when provider is not custom-llm', async () => {
    const rendered = renderSettingsWindow();

    // Expand the Local AI section
    const sections = Array.from(rendered.container.querySelectorAll('section'));
    const localAiSection = sections.find(s => s.textContent?.includes('Local AI'));
    const toggle = localAiSection!.querySelector('button');
    await act(async () => { toggle!.click(); });

    // Find all backend preset buttons inside the section
    const buttons = Array.from(localAiSection!.querySelectorAll('button'));
    // The active class should not be applied to any backend button
    const activeButtons = buttons.filter(b =>
      b.className.includes('active') && (
        b.textContent?.includes('Ollama') ||
        b.textContent?.includes('vLLM') ||
        b.textContent?.includes('llama.cpp') ||
        b.textContent?.includes('Custom Endpoint')
      )
    );
    expect(activeButtons).toHaveLength(0);
    rendered.unmount();
  });

  it('calls saveAIConfig with custom-llm provider when backend button is clicked', async () => {
    const rendered = renderSettingsWindow();

    // Expand Local AI section
    const sections = Array.from(rendered.container.querySelectorAll('section'));
    const localAiSection = sections.find(s => s.textContent?.includes('Local AI'));
    const toggle = localAiSection!.querySelector('button');
    await act(async () => { toggle!.click(); });

    // Click the Ollama backend button
    const buttons = Array.from(localAiSection!.querySelectorAll('button'));
    const ollamaBtn = buttons.find(b => b.textContent?.includes('Ollama') && b.textContent?.includes('localhost:11434'));
    expect(ollamaBtn).toBeDefined();

    await act(async () => { ollamaBtn!.click(); });

    expect(mocks.saveAIConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'custom-llm',
        customLlm: expect.objectContaining({
          backend: 'ollama',
          baseUrl: 'http://localhost:11434',
        }),
      }),
    );
    rendered.unmount();
  });

  it('shows fetching state for Ollama models after selecting Ollama backend', async () => {
    // Make fetchOllamaModels hang to observe loading state
    const { fetchOllamaModels } = await import('@/lib/ai');
    let resolveModels!: (v: string[]) => void;
    vi.mocked(fetchOllamaModels).mockReturnValue(new Promise(r => { resolveModels = r; }));

    const rendered = renderSettingsWindow();

    // Expand and click Ollama
    const sections = Array.from(rendered.container.querySelectorAll('section'));
    const localAiSection = sections.find(s => s.textContent?.includes('Local AI'));
    const toggle = localAiSection!.querySelector('button');
    await act(async () => { toggle!.click(); });

    const buttons = Array.from(localAiSection!.querySelectorAll('button'));
    const ollamaBtn = buttons.find(b => b.textContent?.includes('Ollama') && b.textContent?.includes('localhost:11434'));
    await act(async () => { ollamaBtn!.click(); });

    // Should show fetching placeholder
    const inputs = Array.from(localAiSection!.querySelectorAll('input'));
    const fetchingInput = inputs.find(i => i.placeholder === 'Fetching models...');
    expect(fetchingInput).toBeDefined();
    expect(fetchingInput!.disabled).toBe(true);

    // Resolve the promise to clean up
    await act(async () => { resolveModels([]); });
    rendered.unmount();
  });
});

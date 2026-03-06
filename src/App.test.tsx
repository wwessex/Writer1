/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@tiptap/react', async () => {
  const React = await import('react');
  return {
    EditorContext: React.createContext({ editor: null }),
    useCurrentEditor: () => ({ editor: null }),
    useEditor: () => ({ extensionManager: { extensions: [] } }),
  };
});

vi.mock('@tiptap/starter-kit', () => ({ default: { configure: () => ({}) } }));
vi.mock('@tiptap/extension-underline', () => ({ default: {} }));
vi.mock('@tiptap/extension-horizontal-rule', () => ({ default: {} }));
vi.mock('@tiptap/extension-image', () => ({ default: { configure: () => ({}) } }));
vi.mock('@tiptap/extension-text-style', () => ({ default: {} }));
vi.mock('@tiptap/extension-font-family', () => ({ default: {} }));

vi.mock('@/components/Editor/screenplayExtension', () => ({
  ScreenplayParagraph: { configure: () => ({}) },
  CommentAnchorMark: {},
}));

vi.mock('@/lib/findReplaceExtension', () => ({ FindReplaceExtension: {} }));
vi.mock('@/lib/inlineAIExtension', () => ({ InlineAIExtension: {} }));
vi.mock('@/lib/suggestionModeExtension', () => ({ SuggestionModeExtension: {} }));
vi.mock('@/lib/grammarExtension', () => ({ GrammarCheckExtension: {} }));

vi.mock('@/context/AppContext', () => ({
  AppProvider: ({ children }: { children: unknown }) => <>{children}</>,
    useApp: () => ({
      state: {
        projectType: 'book',
        novelId: 'n1',
        novelTitle: 'Title',
        chapters: [{ id: 'c1', content: { type: 'doc', content: [] } }],
        activeChapterId: 'c1',
        isOnline: true,
        isSaving: false,
        settings: {
          theme: 'dark',
          onboardingComplete: true,
          focusMode: false,
          typewriterMode: false,
          sidebarPanels: { order: ['chapters'], collapsed: {}, visible: {} },
        },
      },
      activeChapter: { id: 'c1', content: { type: 'doc', content: [] } },
      loadNovel: vi.fn(async () => undefined),
      createChapter: vi.fn(async () => undefined),
      dispatch: vi.fn(),
      updateSettings: vi.fn(),
      updateChapter: vi.fn(),
    }),
}));

vi.mock('@/components/AppShell/AppShell', () => ({ AppShell: () => <div data-testid="app-shell" /> }));
vi.mock('@/components/QuickSwitcher', () => ({ QuickSwitcher: () => null }));
vi.mock('@/components/FindReplace', () => ({ FindReplace: () => null, useFindReplace: () => ({}) }));
vi.mock('@/components/Modals', () => ({
  ExportModal: () => null,
  SnapshotModal: () => null,
  AnalysisModal: () => null,
  WordCountModal: () => null,
  DashboardModal: () => null,
  OnboardingModal: () => null,
  CharacterBibleModal: () => null,
  CommentModal: () => null,
  ProjectsModal: () => null,
  SceneTemplatesModal: () => null,
  CorkboardModal: () => null,
  StoryCardsModal: () => null,
  PublishAssistantModal: () => null,
  WritingSprintModal: () => null,
  GuidedFlowModal: () => null,
  CoverDesignModal: () => null,
  ShareModal: () => null,
}));
vi.mock('@/components/Windows', () => ({ SettingsWindow: () => null, AboutWindow: () => null }));
vi.mock('@/components/UI', () => ({
  ToastProvider: ({ children }: { children: unknown }) => <>{children}</>,
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('@/components/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: { children: unknown }) => <>{children}</> }));
vi.mock('@/lib/voiceFingerprint', () => ({ buildCharacterVoiceProfiles: () => [] }));
vi.mock('@/hooks/useModalState', () => ({
  useModalState: () => ({
    modals: {
      export: false,
      snapshot: false,
      analysis: false,
      wordCount: false,
      dashboard: false,
      onboarding: false,
      characterBible: false,
      aiWriting: false,
      comments: false,
      advancedAnalytics: false,
      integrations: false,
      projects: false,
      sceneTemplates: false,
      exportHistory: false,
      translation: false,
      settings: false,
      about: false,
      aiPanel: false,
      corkboard: false,
      storyCards: false,
      publishAssistant: false,
      writingSprint: false,
      guidedFlow: false,
      coverDesign: false,
      share: false,
    },
    openModal: vi.fn(),
    closeModal: vi.fn(),
    toggleModal: vi.fn(),
  }),
}));
vi.mock('@/hooks/useProjectFileActions', () => ({
  useProjectFileActions: () => ({
    fileInputRef: { current: null },
    importInputRef: { current: null },
    projectFileInputRef: { current: null },
    handleExportBackup: vi.fn(),
    handleSaveProjectFile: vi.fn(),
    handleOpenProjectFile: vi.fn(),
    handleImportBackup: vi.fn(),
    handleImportDocument: vi.fn(),
  }),
}));
vi.mock('@/hooks/useCommentActions', () => ({ useCommentActions: () => ({ createCommentFromSelection: vi.fn() }) }));
vi.mock('@/hooks/useAppKeyboardShortcuts', () => ({ useAppKeyboardShortcuts: () => ({ handleMenuAction: vi.fn() }) }));
vi.mock('@/hooks/useLoadNovel', async () => {
  const React = await import('react');
  return {
    useLoadNovel: ({ onLoaded }: { onLoaded: () => void }) => {
      React.useEffect(() => {
        onLoaded();
      }, [onLoaded]);
    },
  };
});
vi.mock('@/hooks/useOnboardingTrigger', () => ({ useOnboardingTrigger: vi.fn() }));
vi.mock('@/hooks/useFocusModeClass', () => ({ useFocusModeClass: vi.fn() }));
vi.mock('@/hooks/useEditorSelectionTracking', () => ({ useEditorSelectionTracking: () => false }));
vi.mock('@/hooks/useVoiceAlerts', () => ({ useVoiceAlerts: () => [] }));
vi.mock('@/hooks/useDesktopRuntime', () => ({ useDesktopRuntime: vi.fn() }));

function renderApp() {
  const container = document.createElement('div');
  const root = createRoot(container);

  act(() => {
    root.render(<App />);
  });

  return { container, unmount: () => act(() => root.unmount()) };
}

describe('App', () => {
  it('renders app shell with providers', () => {
    const rendered = renderApp();
    expect(rendered.container.querySelector('[data-testid="app-shell"]')).not.toBeNull();
    rendered.unmount();
  });
});

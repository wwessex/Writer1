/** @vitest-environment jsdom */
import { act, type ChangeEventHandler, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const setContentMock = vi.fn();
const updateChapterImmediateMock = vi.fn(async () => undefined);

vi.mock('@tiptap/react', () => ({
  useCurrentEditor: () => ({
    editor: {
      commands: { setContent: setContentMock },
      chain: () => ({ focus: () => ({ setScreenplayBlock: () => ({ run: vi.fn() }) }) }),
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
  EditorContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/UI', () => ({
  Input: ({ value, onChange }: { value?: string; onChange?: ChangeEventHandler<HTMLInputElement> }) => (
    <input aria-label="Chapter title" value={value} onChange={onChange} />
  ),
  IconButton: ({ onClick }: { onClick?: () => void }) => <button onClick={onClick}>delete</button>,
  useToast: () => ({ showToast: vi.fn(), showErrorToast: vi.fn() }),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: { settings: { focusMode: false, pageView: false, typewriterMode: false, dailyWordGoal: 0, typography: { fontFamily: 'system', fontSize: 16, lineHeight: 1.6 } }, projectType: 'book', chapters: [] },
    activeChapter: { id: 'chapter-1', title: 'Old', content: { type: 'doc', content: [] } },
    updateChapterImmediate: updateChapterImmediateMock,
    deleteChapter: vi.fn(),
    dispatch: vi.fn(),
  }),
}));

describe('Editor persistence behavior', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    setContentMock.mockClear();
    updateChapterImmediateMock.mockClear();
  });

  it('loads active chapter content and persists title edits immediately', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<Editor screenplayMode={false} onToggleScreenplayMode={() => undefined} />);
    });

    expect(setContentMock).toHaveBeenCalled();

    const input = container.querySelector('input[aria-label="Chapter title"]') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(input, 'Revised');
    await act(async () => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(updateChapterImmediateMock).toHaveBeenCalledWith('chapter-1', { title: 'Revised' });
  });
});

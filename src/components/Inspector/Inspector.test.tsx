/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockUpdateChapterImmediate = vi.fn();
const mockSetActiveChapter = vi.fn();
const mockAddScene = vi.fn();
const mockUpdateScene = vi.fn();
const mockDeleteScene = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      projectType: 'book',
      chapters: [
        {
          id: 'ch-1',
          title: 'Chapter One',
          content: 'Hello world test sentence.',
          status: 'draft',
          tags: ['action', 'romance'],
          wordGoal: 1000,
          scenes: [{ id: 's-1', title: 'Opening', summary: '', status: 'draft', pov: '', tags: [], wordGoal: 0, location: '' }],
          part: 'Part I',
          updatedAt: Date.now(),
          pov: 'Alice',
          summary: 'A test chapter',
          order: 0,
        },
        {
          id: 'ch-2',
          title: 'Chapter Two',
          content: null,
          status: 'planned',
          tags: ['mystery'],
          wordGoal: 0,
          scenes: [],
          part: 'Part II',
          updatedAt: Date.now(),
          pov: '',
          summary: '',
          order: 1,
        },
      ],
      settings: { theme: 'light' },
    },
    activeChapter: {
      id: 'ch-1',
      title: 'Chapter One',
      content: 'Hello world test sentence.',
      status: 'draft',
      tags: ['action', 'romance'],
      wordGoal: 1000,
      scenes: [{ id: 's-1', title: 'Opening', summary: '', status: 'draft', pov: '', tags: [], wordGoal: 0, location: '' }],
      part: 'Part I',
      pov: 'Alice',
      summary: 'A test chapter',
    },
    setActiveChapter: mockSetActiveChapter,
    updateChapterImmediate: mockUpdateChapterImmediate,
    addScene: mockAddScene,
    updateScene: mockUpdateScene,
    deleteScene: mockDeleteScene,
  }),
}));

vi.mock('@/components/UI', () => ({
  Input: ({ value, placeholder, list }: { value?: string; placeholder?: string; list?: string }) => (
    <input value={value || ''} placeholder={placeholder} data-list={list} readOnly />
  ),
  Textarea: ({ value, placeholder }: { value?: string; placeholder?: string }) => (
    <textarea value={value || ''} placeholder={placeholder} readOnly />
  ),
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  IconButton: ({ icon, label, onClick }: { icon?: string; label?: string; onClick?: () => void }) => (
    <button onClick={onClick} aria-label={label}>{icon}</button>
  ),
}));

vi.mock('@/components/UI/Tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/UI/Select', () => ({
  Select: ({ options, value }: { options: { value: string; label: string }[]; value: string }) => (
    <select value={value}>
      {options.map((o: { value: string; label: string }) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

vi.mock('@/hooks/useResizable', () => ({
  useResizable: () => ({ size: 300, isResizing: false, handleProps: {} }),
}));

vi.mock('@/hooks/useModalAccessibility', () => ({
  useModalAccessibility: () => {},
}));

vi.mock('@/lib/narrativeWeather', () => ({
  buildNarrativeWeather: () => ({ points: [], climateBands: [] }),
}));

vi.mock('@/lib/timelineConsistency', () => ({
  analyzeTimelineConsistency: () => ({ findings: [], extractedTimelineCount: 0 }),
}));

import { Inspector } from './Inspector';

describe('Inspector', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('renders nothing when not open', async () => {
    await act(async () => {
      root.render(<Inspector open={false} onClose={vi.fn()} />);
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders inspector tabs when open', async () => {
    await act(async () => {
      root.render(<Inspector open onClose={vi.fn()} />);
    });
    expect(container.textContent).toContain('Chapter');
    expect(container.textContent).toContain('Scenes');
    expect(container.textContent).toContain('Notes');
  });

  it('shows chapter metadata fields in details tab', async () => {
    await act(async () => {
      root.render(<Inspector open onClose={vi.fn()} />);
    });
    expect(container.textContent).toContain('Synopsis');
    expect(container.textContent).toContain('Status');
    expect(container.textContent).toContain('Part');
    expect(container.textContent).toContain('POV Character');
    expect(container.textContent).toContain('Tags');
    expect(container.textContent).toContain('Word Goal');
  });

  it('shows word count stats', async () => {
    await act(async () => {
      root.render(<Inspector open onClose={vi.fn()} />);
    });
    expect(container.textContent).toContain('words');
    expect(container.textContent).toContain('sentences');
    expect(container.textContent).toContain('paragraphs');
  });

  it('renders Part field with datalist for autocomplete', async () => {
    await act(async () => {
      root.render(<Inspector open onClose={vi.fn()} />);
    });
    const partInput = container.querySelector('input[data-list="part-suggestions"]');
    expect(partInput).toBeTruthy();
    const datalist = container.querySelector('datalist#part-suggestions');
    expect(datalist).toBeTruthy();
  });

  it('renders Tags field with datalist for autocomplete', async () => {
    await act(async () => {
      root.render(<Inspector open onClose={vi.fn()} />);
    });
    const tagInput = container.querySelector('input[data-list="tag-suggestions"]');
    expect(tagInput).toBeTruthy();
    const datalist = container.querySelector('datalist#tag-suggestions');
    expect(datalist).toBeTruthy();
  });

  it('shows scene count', async () => {
    await act(async () => {
      root.render(<Inspector open onClose={vi.fn()} />);
    });
    expect(container.textContent).toContain('scenes');
  });
});

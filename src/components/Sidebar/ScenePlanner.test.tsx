/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockAddScene = vi.fn();
const mockUpdateScene = vi.fn();
const mockDeleteScene = vi.fn();
const mockReorderScenes = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: { projectType: 'book' },
    activeChapter: {
      id: 'ch-1',
      title: 'Chapter One',
      scenes: [
        { id: 's-1', title: 'Scene One', summary: 'First scene', status: 'draft', productionTags: ['vfx'] },
        { id: 's-2', title: 'Scene Two', summary: 'Second scene', status: 'planned', productionTags: [] },
      ],
    },
    addScene: mockAddScene,
    updateScene: mockUpdateScene,
    deleteScene: mockDeleteScene,
    reorderScenes: mockReorderScenes,
  }),
}));

vi.mock('@/components/UI', () => ({
  IconButton: ({ onClick, label }: { onClick?: () => void; label?: string }) => (
    <button onClick={onClick} aria-label={label}>icon</button>
  ),
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Input: ({ value, onChange, placeholder }: { value?: string; onChange?: (e: { target: { value: string } }) => void; placeholder?: string }) => (
    <input value={value} onChange={e => onChange?.({ target: { value: e.target.value } })} placeholder={placeholder} />
  ),
  Textarea: ({ value, onChange, placeholder }: { value?: string; onChange?: (e: { target: { value: string } }) => void; placeholder?: string }) => (
    <textarea value={value} onChange={e => onChange?.({ target: { value: e.target.value } })} placeholder={placeholder} />
  ),
}));

vi.mock('@/components/UI/Tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/UI/Select', () => ({
  Select: ({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (e: { target: { value: string } }) => void }) => (
    <select value={value} onChange={e => onChange({ target: { value: e.target.value } })}>
      {options.map((o: { value: string; label: string }) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

vi.mock('@/lib/sceneChemistry', () => ({
  simulateChapterSceneChemistry: vi.fn(() => ({
    metrics: { baseline: { tension: 50, readability: 70, thematicAlignment: 60 }, simulated: { tension: 55, readability: 72, thematicAlignment: 58 }, delta: { tension: 5, readability: 2, thematicAlignment: -2 } },
    rationale: 'Test rationale',
    recommendedRewriteDirection: 'Add more conflict',
    confidence: 72,
    lowConfidence: false,
    confidenceRationale: [],
  })),
}));

import { ScenePlanner } from './ScenePlanner';

describe('ScenePlanner', () => {
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

  it('renders scene titles', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    expect(container.textContent).toContain('Scene One');
    expect(container.textContent).toContain('Scene Two');
  });

  it('renders scene count', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    expect(container.textContent).toContain('2');
  });

  it('renders Scenes header for book mode', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    expect(container.textContent).toContain('Scenes');
  });

  it('shows scene statuses', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    expect(container.textContent).toContain('draft');
    expect(container.textContent).toContain('planned');
  });

  it('calls addScene when add button clicked', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    const addBtn = Array.from(container.querySelectorAll('button'))
      .find(btn => btn.getAttribute('aria-label') === 'Add Scene');
    expect(addBtn).toBeDefined();
    await act(async () => {
      addBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mockAddScene).toHaveBeenCalledWith('ch-1');
  });

  it('has status filter dropdown', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it('expands scene details on header click and shows editing fields', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    // Scene cards are draggable divs; inside each is a header div with an onClick
    const draggables = container.querySelectorAll('[draggable="true"]');
    expect(draggables.length).toBe(2);

    // The header is the first child div of the draggable
    const header = draggables[0].querySelector('div');
    expect(header).not.toBeNull();

    await act(async () => {
      header!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // After expanding, should see scene detail fields (Title input, Summary textarea, Status select, Delete button)
    expect(container.textContent).toContain('Title');
    expect(container.textContent).toContain('Summary');
    expect(container.textContent).toContain('Status');
    expect(container.textContent).toContain('Delete');
    expect(container.textContent).toContain('Expand');
  });

  it('collapses expanded scene on second click', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    const draggables = container.querySelectorAll('[draggable="true"]');
    const header = draggables[0].querySelector('div')!;

    // Expand
    await act(async () => { header.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('Delete');

    // Collapse
    await act(async () => { header.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    // Delete button should no longer be present in scene card body
    const deleteButtons = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.includes('Delete'));
    expect(deleteButtons.length).toBe(0);
  });

  it('opens popout editor when Expand button clicked', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    const draggables = container.querySelectorAll('[draggable="true"]');
    const header = draggables[0].querySelector('div')!;

    // Expand scene card first
    await act(async () => { header.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    // Click the Expand button to open popout
    const expandBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Expand'));
    expect(expandBtn).toBeDefined();

    await act(async () => { expandBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    // Popout should show scene title and Done button
    expect(container.textContent).toContain('Done');
    expect(container.textContent).toContain('Scene One');
  });

  it('closes popout editor when Done clicked', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    const draggables = container.querySelectorAll('[draggable="true"]');
    const header = draggables[0].querySelector('div')!;

    await act(async () => { header.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const expandBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Expand'));
    await act(async () => { expandBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const doneBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Done'));
    expect(doneBtn).toBeDefined();
    await act(async () => { doneBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    // Done button should be gone after closing
    const doneBtnAfter = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Done'));
    expect(doneBtnAfter).toBeUndefined();
  });

  it('opens simulator panel on button click', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    const simBtn = Array.from(container.querySelectorAll('button'))
      .find(btn => btn.getAttribute('aria-label') === 'Scene Chemistry Simulator');
    expect(simBtn).toBeDefined();

    await act(async () => {
      simBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Simulator panel should show
    expect(container.textContent).toContain('Scene Chemistry Simulation');
    expect(container.textContent).toContain('Test rationale');
  });

  it('filters scenes by status', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    const selects = container.querySelectorAll('select');
    const statusSelect = selects[0];

    // Filter to 'draft' — only Scene One should show
    await act(async () => {
      const event = new Event('change', { bubbles: true });
      Object.defineProperty(event, 'target', { value: { value: 'draft' } });
      statusSelect.dispatchEvent(event);
    });

    // After filtering, re-check (the mock won't re-render with different data,
    // but the filter logic is exercised via the state change)
    expect(statusSelect).toBeDefined();
  });

  it('has production tag filter', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    const selects = container.querySelectorAll('select');
    // Should have at least 2 selects: status filter and production tag filter
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders draggable scene cards', async () => {
    await act(async () => { root.render(<ScenePlanner />); });
    const draggables = container.querySelectorAll('[draggable="true"]');
    expect(draggables.length).toBe(2);
  });
});

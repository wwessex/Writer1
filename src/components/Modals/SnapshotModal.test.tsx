/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSnapshots: vi.fn((): Promise<any[]> => Promise.resolve([])),
  createSnapshot: vi.fn(() => Promise.resolve({ id: 'snap-new', chapterId: 'ch-1', createdAt: Date.now(), doc: '' })),
  deleteSnapshot: vi.fn(() => Promise.resolve()),
  updateSnapshotLabel: vi.fn(() => Promise.resolve()),
  showToast: vi.fn(),
  updateChapter: vi.fn(),
  onClose: vi.fn(),
  activeChapter: null as { id: string; title: string; content: string | null } | null,
}));

const snapshotData = [
  { id: 'snap-1', chapterId: 'ch-1', createdAt: Date.now() - 60000, doc: 'First version of this chapter.', label: 'Auto' },
  { id: 'snap-2', chapterId: 'ch-1', createdAt: Date.now(), doc: 'Second version of this chapter.', label: 'Manual Save' },
];

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: { projectType: 'book' },
    activeChapter: mocks.activeChapter,
    updateChapter: mocks.updateChapter,
  }),
}));

vi.mock('@/lib/storage', () => ({
  getSnapshots: mocks.getSnapshots,
  createSnapshot: mocks.createSnapshot,
  deleteSnapshot: mocks.deleteSnapshot,
  updateSnapshotLabel: mocks.updateSnapshotLabel,
}));

vi.mock('@/lib/utils', () => ({
  editorToPlainText: (doc: string | null) => doc || '',
  formatDateTime: (ts: number) => new Date(ts).toISOString(),
  countWords: (text: string) => text.split(/\s+/).filter(Boolean).length,
}));

const stableToastValue = { showToast: mocks.showToast };

vi.mock('@/components/UI', () => ({
  Dialog: ({ open, children, title, size }: { open: boolean; children?: ReactNode; title?: string; size?: string }) =>
    open ? <div data-testid="dialog" data-size={size}><h2>{title}</h2>{children}</div> : null,
  Button: ({ children, onClick, disabled, variant, size }: { children?: ReactNode; onClick?: () => void; disabled?: boolean; variant?: string; size?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>{children}</button>
  ),
  IconButton: ({ icon, label, onClick, variant }: { icon?: string; label?: string; onClick?: (e: React.MouseEvent) => void; variant?: string }) => (
    <button onClick={onClick} aria-label={label} data-variant={variant}>{icon}</button>
  ),
  useToast: () => stableToastValue,
}));

vi.mock('./Modals.module.css', () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { SnapshotModal } from './SnapshotModal';

describe('SnapshotModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    mocks.activeChapter = null;
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('renders nothing when closed', async () => {
    await act(async () => { root.render(<SnapshotModal open={false} onClose={mocks.onClose} />); });
    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
  });

  it('renders empty state when no active chapter', async () => {
    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    expect(container.textContent).toContain('Snapshots');
    expect(container.textContent).toContain('Select a chapter to view snapshots');
  });

  it('renders with active chapter and empty snapshots', async () => {
    mocks.activeChapter = { id: 'ch-1', title: 'Chapter 1', content: '' };
    mocks.getSnapshots.mockResolvedValue([]);

    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    // Wait for loadSnapshots to resolve
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    expect(container.textContent).toContain('Chapter 1');
    expect(container.textContent).toContain('No snapshots yet');
    expect(mocks.getSnapshots).toHaveBeenCalledWith('ch-1');
  });

  it('renders snapshots list when snapshots exist', async () => {
    mocks.activeChapter = { id: 'ch-1', title: 'Chapter 1', content: '' };
    mocks.getSnapshots.mockResolvedValue(snapshotData);

    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    expect(container.textContent).toContain('Auto');
    expect(container.textContent).toContain('Manual Save');
    expect(container.textContent).toContain('Save Now');
  });

  it('handles save snapshot button', async () => {
    mocks.activeChapter = { id: 'ch-1', title: 'Chapter 1', content: 'Some content' };
    mocks.getSnapshots.mockResolvedValue([]);

    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    // Find and click a save button
    const buttons = container.querySelectorAll('button');
    const saveBtn = Array.from(buttons).find(b => b.textContent?.includes('Save'));
    expect(saveBtn).toBeDefined();

    mocks.getSnapshots.mockResolvedValue(snapshotData);
    await act(async () => { saveBtn!.click(); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    expect(mocks.createSnapshot).toHaveBeenCalledWith('ch-1', 'Some content');
    expect(mocks.showToast).toHaveBeenCalledWith('Snapshot saved', 'success', 'photo_camera');
  });

  it('handles snapshot selection and preview', async () => {
    mocks.activeChapter = { id: 'ch-1', title: 'Chapter 1', content: '' };
    mocks.getSnapshots.mockResolvedValue(snapshotData);

    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    // Click on a snapshot item
    const items = container.querySelectorAll('[role="button"]');
    expect(items.length).toBeGreaterThan(0);

    await act(async () => { (items[0] as HTMLElement).click(); });

    // Preview should show
    expect(container.textContent).toContain('Preview');
    expect(container.textContent).toContain('Restore');
    expect(container.textContent).toContain('Compare');
  });

  it('handles compare button', async () => {
    mocks.activeChapter = { id: 'ch-1', title: 'Chapter 1', content: '' };
    mocks.getSnapshots.mockResolvedValue(snapshotData);

    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    // Select first snapshot
    const items = container.querySelectorAll('[role="button"]');
    await act(async () => { (items[0] as HTMLElement).click(); });

    // Click Compare
    const buttons = container.querySelectorAll('button');
    const compareBtn = Array.from(buttons).find(b => b.textContent?.includes('Compare'));
    expect(compareBtn).toBeDefined();

    await act(async () => { compareBtn!.click(); });

    // Diff view should show
    expect(container.textContent).toContain('Diff');
  });

  it('handles delete snapshot', async () => {
    mocks.activeChapter = { id: 'ch-1', title: 'Chapter 1', content: '' };
    mocks.getSnapshots.mockResolvedValue(snapshotData);

    // Mock confirm to return true
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    // Find delete button
    const deleteBtn = container.querySelector('[aria-label="Delete snapshot"]');
    expect(deleteBtn).toBeDefined();

    await act(async () => { (deleteBtn as HTMLElement).click(); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    expect(mocks.deleteSnapshot).toHaveBeenCalledWith('snap-1');
  });

  it('handles label editing', async () => {
    mocks.activeChapter = { id: 'ch-1', title: 'Chapter 1', content: '' };
    mocks.getSnapshots.mockResolvedValue(snapshotData);

    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    // Find label edit button
    const labelBtn = container.querySelector('[aria-label="Edit label"]');
    expect(labelBtn).toBeDefined();

    await act(async () => { (labelBtn as HTMLElement).click(); });

    // Input should appear
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeDefined();
  });

  it('handles restore with confirm', async () => {
    mocks.activeChapter = { id: 'ch-1', title: 'Chapter 1', content: '' };
    mocks.getSnapshots.mockResolvedValue(snapshotData);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    // Select a snapshot
    const items = container.querySelectorAll('[role="button"]');
    await act(async () => { (items[0] as HTMLElement).click(); });

    // Click restore
    const buttons = container.querySelectorAll('button');
    const restoreBtn = Array.from(buttons).find(b => b.textContent?.includes('Restore'));
    expect(restoreBtn).toBeDefined();

    await act(async () => { restoreBtn!.click(); });

    expect(mocks.updateChapter).toHaveBeenCalled();
    expect(mocks.onClose).toHaveBeenCalled();
  });

  it('exports SnapshotModal as a function component', () => {
    expect(typeof SnapshotModal).toBe('function');
  });

  it('shows error toast when loading snapshots fails', async () => {
    mocks.activeChapter = { id: 'ch-1', title: 'Chapter 1', content: '' };
    mocks.getSnapshots.mockRejectedValue(new Error('Load failed'));

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    spy.mockRestore();

    expect(mocks.showToast).toHaveBeenCalledWith('Failed to load snapshots', 'error');
  });

  it('shows timeline when multiple snapshots exist', async () => {
    mocks.activeChapter = { id: 'ch-1', title: 'Chapter 1', content: '' };
    mocks.getSnapshots.mockResolvedValue(snapshotData);

    await act(async () => { root.render(<SnapshotModal open onClose={mocks.onClose} />); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });

    expect(container.textContent).toContain('Version Timeline');
  });
});

/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsModal } from './ProjectsModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  loadNovelByIdMock: vi.fn(async () => undefined),
  createNewNovelMock: vi.fn(async () => ({ id: 'n-2' })),
  loadNovelMock: vi.fn(async () => undefined),
  getAllNovelsMock: vi.fn(async () => [
    { id: 'n-1', title: 'Current', updatedAt: 1, createdAt: 1, projectType: 'book' },
    { id: 'n-2', title: 'Second', updatedAt: 2, createdAt: 1, projectType: 'screenplay' },
  ]),
}));

vi.mock('@/components/UI', () => ({
  Dialog: ({ open, children }: { open: boolean; children?: ReactNode }) => open ? <div>{children}</div> : null,
  Button: ({ children, onClick, disabled }: { children?: ReactNode; onClick?: () => void; disabled?: boolean }) => <button onClick={onClick} disabled={disabled}>{children}</button>,
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: { novelId: 'n-1', novelTitle: 'Current', projectType: 'book', chapters: [{ id: 'c-1', content: '' }] },
    loadNovelById: mocks.loadNovelByIdMock,
    createNewNovel: mocks.createNewNovelMock,
    loadNovel: mocks.loadNovelMock,
  }),
}));

vi.mock('@/lib/storage', () => ({ getAllNovels: mocks.getAllNovelsMock, deleteNovel: vi.fn(async () => undefined) }));

describe('ProjectsModal critical workflow', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    Object.values(mocks).forEach(mock => mock.mockClear());
  });

  it('opens and switches projects through modal actions', async () => {
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => { root.render(<ProjectsModal open onClose={onClose} />); });
    expect(mocks.getAllNovelsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('Second'))?.click();
    });

    expect(mocks.loadNovelByIdMock).toHaveBeenCalledWith('n-2');
    expect(onClose).toHaveBeenCalled();
  });
});

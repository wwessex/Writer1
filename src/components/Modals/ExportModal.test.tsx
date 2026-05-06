/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  projectType: 'book' as 'book' | 'screenplay',
  exportToDocx: vi.fn(async () => {}),
  exportToPdf: vi.fn(async () => {}),
  exportToRtf: vi.fn(async () => {}),
  exportToFountain: vi.fn(async () => {}),
  exportToScreenplayPdf: vi.fn(async () => {}),
  exportToMarkdown: vi.fn(async () => {}),
  exportToPlainText: vi.fn(async () => {}),
  exportPublishingBundle: vi.fn(async () => {}),
  recordExport: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      projectType: mocks.projectType,
      novelTitle: mocks.projectType === 'screenplay' ? 'Night Signal' : 'Harbour Draft',
      chapters: [
        {
          id: 'c1',
          novelId: 'n1',
          order: 0,
          title: mocks.projectType === 'screenplay' ? 'INT. LIGHTHOUSE - NIGHT' : 'Chapter One',
          updatedAt: 0,
          content: mocks.projectType === 'screenplay'
            ? 'INT. LIGHTHOUSE - NIGHT\n\nA beacon turns.'
            : 'A clean chapter body with enough words to export.',
          summary: '',
          pov: '',
          status: 'draft',
          tags: [],
          wordGoal: 0,
          scenes: [],
        },
      ],
    },
  }),
}));

vi.mock('@/components/UI', () => ({
  Dialog: ({ open, title, children }: { open: boolean; title: string; children?: ReactNode }) =>
    open ? <div role="dialog" aria-label={title}>{children}</div> : null,
  Button: ({ children, onClick, disabled }: { children?: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('@/components/UI/Tooltip', () => ({
  HelpTooltip: () => null,
}));

vi.mock('@/lib/export', () => ({
  exportToDocx: mocks.exportToDocx,
  exportToPdf: mocks.exportToPdf,
  exportToRtf: mocks.exportToRtf,
  exportToFountain: mocks.exportToFountain,
  exportToScreenplayPdf: mocks.exportToScreenplayPdf,
  exportToMarkdown: mocks.exportToMarkdown,
  exportToPlainText: mocks.exportToPlainText,
  exportPublishingBundle: mocks.exportPublishingBundle,
}));

vi.mock('@/lib/exportHistory', () => ({
  recordExport: mocks.recordExport,
}));

import { ExportModal } from './ExportModal';

describe('ExportModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onClose: () => void;
  let onCloseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mocks.projectType = 'book';
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onCloseMock = vi.fn();
    onClose = onCloseMock as () => void;
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('exports every custom book format from the export menu', async () => {
    await renderModal();
    await clickButton('Custom');

    await clickButton('Export DOCX');
    await clickButton('Export PDF');
    await clickButton('Export RTF');
    await clickButton('Export Markdown');
    await clickButton('Export Plain Text');

    expect(mocks.exportToDocx).toHaveBeenCalledTimes(1);
    expect(mocks.exportToPdf).toHaveBeenCalledTimes(1);
    expect(mocks.exportToRtf).toHaveBeenCalledTimes(1);
    expect(mocks.exportToMarkdown).toHaveBeenCalledTimes(1);
    expect(mocks.exportToPlainText).toHaveBeenCalledTimes(1);
    expect(mocks.showToast).toHaveBeenCalledTimes(5);
    expect(onCloseMock).toHaveBeenCalledTimes(5);
  });

  it('exports all manuscript tab formats', async () => {
    await renderModal();
    await clickButton('Manuscript');

    await chooseManuscriptFormat('docx');
    await clickButton('Export DOCX');
    await chooseManuscriptFormat('pdf');
    await clickButton('Export PDF');
    await chooseManuscriptFormat('rtf');
    await clickButton('Export RTF');

    expect(mocks.exportToDocx).toHaveBeenCalledTimes(1);
    expect(mocks.exportToPdf).toHaveBeenCalledTimes(1);
    expect(mocks.exportToRtf).toHaveBeenCalledTimes(1);
  });

  it('exports the publishing bundle option', async () => {
    await renderModal();
    await clickButton('Publishing');
    await clickButton('Export Publishing Bundle');

    expect(mocks.exportPublishingBundle).toHaveBeenCalledTimes(1);
    const bundleCall = mocks.exportPublishingBundle.mock.calls[0] as unknown[];
    expect(bundleCall[2]).toMatchObject({
      includeHeadings: true,
      includeKdpTemplate: true,
      manuscriptFormat: 'docx',
    });
  });

  it('exports screenplay PDF and Fountain custom options', async () => {
    mocks.projectType = 'screenplay';
    await renderModal();
    await clickButton('Custom');

    await clickButton('Export Screenplay PDF');
    await clickButton('Export Fountain');

    expect(mocks.exportToScreenplayPdf).toHaveBeenCalledTimes(1);
    expect(mocks.exportToFountain).toHaveBeenCalledWith(
      expect.any(Array),
      'Night Signal',
      expect.objectContaining({
        includeSectionTitles: true,
        includeMetadataBlock: true,
        filenameConvention: 'title',
      }),
    );
  });

  it('uses preset export options immediately instead of stale component state', async () => {
    await renderModal();
    await clickButton('Plain Export (RTF)');

    expect(mocks.exportToRtf).toHaveBeenCalledWith(
      expect.any(Array),
      'Harbour Draft',
      false,
      undefined,
    );
  });

  async function renderModal() {
    await act(async () => {
      root.render(<ExportModal open={true} onClose={onClose} />);
    });
  }

  function findButton(text: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll('button'))
      .find(candidate => candidate.textContent?.includes(text));
    if (!button) {
      throw new Error(`Could not find button containing "${text}"`);
    }
    return button as HTMLButtonElement;
  }

  async function clickButton(text: string) {
    await act(async () => {
      findButton(text).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  async function chooseManuscriptFormat(format: 'docx' | 'pdf' | 'rtf') {
    const selects = container.querySelectorAll('select');
    const formatSelect = selects[2] as HTMLSelectElement | undefined;
    if (!formatSelect) {
      throw new Error('Could not find manuscript format select');
    }
    await act(async () => {
      formatSelect.value = format;
      formatSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
});

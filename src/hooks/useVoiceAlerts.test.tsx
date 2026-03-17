/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { useVoiceAlerts } from './useVoiceAlerts';
import type { Chapter } from '@/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getDialogueSimilarityAlertsMock = vi.fn();

vi.mock('@/lib/voiceFingerprint', () => ({
  DEFAULT_VOICE_SIMILARITY_CONFIG: { threshold: 0.8 },
  getDialogueSimilarityAlerts: (...args: unknown[]) => getDialogueSimilarityAlertsMock(...args),
}));

const chapter: Chapter = {
  id: 'chapter-1',
  novelId: 'novel-1',
  order: 1,
  title: 'Opening',
  updatedAt: Date.now(),
  content: 'Some text',
  summary: '',
  pov: '',
  status: 'draft',
  tags: [],
  wordGoal: 0,
  scenes: [],
};

function mount(props: Parameters<typeof useVoiceAlerts>[0]) {
  const container = document.createElement('div');
  const root = createRoot(container);

  function Test(testProps: Parameters<typeof useVoiceAlerts>[0]) {
    const alerts = useVoiceAlerts(testProps);
    return <span data-count={String(alerts.length)} />;
  }

  act(() => {
    root.render(<Test {...props} />);
  });

  return {
    rerender: (nextProps: Parameters<typeof useVoiceAlerts>[0]) => {
      act(() => {
        root.render(<Test {...nextProps} />);
      });
    },
    count: () => container.querySelector('span')?.getAttribute('data-count'),
    unmount: () => act(() => root.unmount()),
  };
}

describe('useVoiceAlerts', () => {
  it('updates alerts and only emits toast when signature changes', () => {
    const showToast = vi.fn();
    const alerts = [
      { activeSpeaker: 'A', comparedSpeaker: 'B', similarity: 0.91 },
    ];
    getDialogueSimilarityAlertsMock.mockReturnValue(alerts);

    const harness = mount({ activeChapter: chapter, baselineProfiles: [], showToast });

    expect(harness.count()).toBe('1');
    expect(showToast).toHaveBeenCalledTimes(1);

    harness.rerender({ activeChapter: chapter, baselineProfiles: [], showToast });
    expect(showToast).toHaveBeenCalledTimes(1);

    getDialogueSimilarityAlertsMock.mockReturnValue([
      { activeSpeaker: 'A', comparedSpeaker: 'C', similarity: 0.93 },
    ]);
    harness.rerender({ activeChapter: chapter, baselineProfiles: [], showToast });
    expect(showToast).toHaveBeenCalledTimes(2);

    harness.unmount();
  });

  it('clears alerts when there is no active chapter', () => {
    const showToast = vi.fn();
    getDialogueSimilarityAlertsMock.mockReturnValue([{ activeSpeaker: 'A', comparedSpeaker: 'B', similarity: 0.9 }]);

    const harness = mount({ activeChapter: chapter, baselineProfiles: [], showToast });
    expect(harness.count()).toBe('1');

    harness.rerender({ activeChapter: null, baselineProfiles: [], showToast });
    expect(harness.count()).toBe('0');
  });
});

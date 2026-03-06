/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';

// Mock every sub-module so we can import the barrel without pulling in real components.
vi.mock('./ExportModal', () => ({ ExportModal: 'ExportModal' }));
vi.mock('./SnapshotModal', () => ({ SnapshotModal: 'SnapshotModal' }));
vi.mock('./AnalysisModal', () => ({ AnalysisModal: 'AnalysisModal' }));
vi.mock('./WordCountModal', () => ({ WordCountModal: 'WordCountModal' }));
vi.mock('./DashboardModal', () => ({ DashboardModal: 'DashboardModal' }));
vi.mock('./OnboardingModal', () => ({ OnboardingModal: 'OnboardingModal' }));
vi.mock('./AIWritingModal', () => ({ AIWritingModal: 'AIWritingModal' }));
vi.mock('./CharacterBibleModal', () => ({ CharacterBibleModal: 'CharacterBibleModal' }));
vi.mock('./CommentModal', () => ({ CommentModal: 'CommentModal' }));
vi.mock('./AdvancedAnalyticsModal', () => ({ AdvancedAnalyticsModal: 'AdvancedAnalyticsModal' }));
vi.mock('./IntegrationsModal', () => ({ IntegrationsModal: 'IntegrationsModal' }));
vi.mock('./ConflictResolutionModal', () => ({ ConflictResolutionModal: 'ConflictResolutionModal' }));
vi.mock('./ProjectsModal', () => ({ ProjectsModal: 'ProjectsModal' }));
vi.mock('./SceneTemplatesModal', () => ({ SceneTemplatesModal: 'SceneTemplatesModal' }));
vi.mock('./ExportHistoryModal', () => ({ ExportHistoryModal: 'ExportHistoryModal' }));
vi.mock('./TranslationModal', () => ({ TranslationModal: 'TranslationModal' }));
vi.mock('./CorkboardModal', () => ({ CorkboardModal: 'CorkboardModal' }));
vi.mock('./StoryCardsModal', () => ({ StoryCardsModal: 'StoryCardsModal' }));
vi.mock('./PublishAssistantModal', () => ({ PublishAssistantModal: 'PublishAssistantModal' }));
vi.mock('./WritingSprintModal', () => ({ WritingSprintModal: 'WritingSprintModal' }));
vi.mock('./GuidedFlowModal', () => ({ GuidedFlowModal: 'GuidedFlowModal' }));
vi.mock('./CoverDesignModal', () => ({ CoverDesignModal: 'CoverDesignModal' }));
vi.mock('./ShareModal', () => ({ ShareModal: 'ShareModal' }));

import * as barrel from './index';

describe('Modals barrel export', () => {
  it('re-exports all modal components', () => {
    const expected = [
      'ExportModal',
      'SnapshotModal',
      'AnalysisModal',
      'WordCountModal',
      'DashboardModal',
      'OnboardingModal',
      'AIWritingModal',
      'CharacterBibleModal',
      'CommentModal',
      'AdvancedAnalyticsModal',
      'IntegrationsModal',
      'ConflictResolutionModal',
      'ProjectsModal',
      'SceneTemplatesModal',
      'ExportHistoryModal',
      'TranslationModal',
      'CorkboardModal',
      'StoryCardsModal',
      'PublishAssistantModal',
      'WritingSprintModal',
      'GuidedFlowModal',
      'CoverDesignModal',
      'ShareModal',
    ];

    for (const name of expected) {
      expect(barrel).toHaveProperty(name);
    }

    expect(Object.keys(barrel)).toHaveLength(expected.length);
  });
});

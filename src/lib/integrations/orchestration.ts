import { pluginManager } from '@/lib/plugins';
import type { AppState, Chapter } from '@/types';
import { mergeChapterFromRemote } from './sync';
import type { NormalizedPullResult, ProviderDocument, ProviderPayload } from './types';

function chapterContentToText(chapter: Chapter): string {
  if (!chapter.content || !Array.isArray(chapter.content.content)) {
    return chapter.summary || '';
  }

  return chapter.content.content
    .map((node) => {
      if (typeof node.text === 'string') return node.text;
      if (Array.isArray(node.content)) {
        return node.content
          .map((child) => (typeof child.text === 'string' ? child.text : ''))
          .join(' ');
      }
      return '';
    })
    .join('\n')
    .trim();
}

export function mapAppStateToProviderPayload(
  appState: Pick<AppState, 'novelId' | 'projectType' | 'chapters'>
): ProviderPayload {
  const chapters: ProviderDocument[] = appState.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    order: chapter.order,
    updatedAt: chapter.updatedAt,
    body: chapterContentToText(chapter),
  }));

  return {
    novelId: appState.novelId,
    projectType: appState.projectType,
    chapters,
  };
}

export function normalizeProviderPullResponse(
  appChapters: Chapter[],
  remoteDocuments: ProviderDocument[],
  remoteRevision: string,
  provider: 'dropbox' | 'google-drive' | 'scrivener'
): NormalizedPullResult {
  const appById = new Map(appChapters.map((chapter) => [chapter.id, chapter]));
  const defaultNovelId = appChapters[0]?.novelId || '';

  const chapterUpdates: Chapter[] = [];
  const conflicts: NormalizedPullResult['conflicts'] = [];

  remoteDocuments.forEach((document, index) => {
    const existing = appById.get(document.id);
    const fallback = appChapters[index];

    if (!existing && !fallback) {
      chapterUpdates.push({
        id: document.id,
        novelId: defaultNovelId,
        order: document.order,
        title: document.title,
        updatedAt: document.updatedAt,
        content: null,
        summary: document.body.slice(0, 200),
        pov: '',
        status: 'draft' as const,
        tags: [],
        wordGoal: 0,
        scenes: [],
        sync: {
          providerRevisionIds: { [provider]: remoteRevision },
          lastPushedHash: undefined,
          lastPulledAt: Date.now(),
          lastSyncedContent: null,
        },
      });
      return;
    }

    const baseChapter = (existing || fallback) as Chapter;
    const mergeResult = mergeChapterFromRemote({
      chapter: baseChapter,
      remoteDocument: document,
      context: {
        provider,
        remoteRevision,
      },
    });

    chapterUpdates.push(mergeResult.chapterUpdate);
    if (mergeResult.conflict) {
      conflicts.push(mergeResult.conflict);
    }
  });

  pluginManager.emit('sync:pull:normalized', {
    provider,
    remoteRevision,
    chapterCount: chapterUpdates.length,
    conflictCount: conflicts.length,
  });

  return { chapterUpdates, remoteRevision, conflicts };
}

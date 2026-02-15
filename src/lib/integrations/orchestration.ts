import type { AppState, Chapter } from '@/types';
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
  remoteRevision: string
): NormalizedPullResult {
  const appById = new Map(appChapters.map((chapter) => [chapter.id, chapter]));
  const defaultNovelId = appChapters[0]?.novelId || '';

  const chapterUpdates = remoteDocuments.map((document, index) => {
    const existing = appById.get(document.id);
    const fallback = appChapters[index];

    if (!existing && !fallback) {
      return {
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
      };
    }

    return {
      ...(existing || fallback),
      id: document.id,
      title: document.title,
      order: document.order,
      updatedAt: document.updatedAt,
      summary: document.body.slice(0, 200),
    } as Chapter;
  });

  return { chapterUpdates, remoteRevision };
}

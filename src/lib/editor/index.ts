// Barrel export for the editor module
export { EditorContext, useCurrentEditor } from './EditorContext';
export { useCodeMirrorEditor } from './useCodeMirrorEditor';
export { CodeMirrorAdapter } from './codemirrorAdapter';
export type { EditorAdapter, EditorSelection, CommentAnchor, FindReplaceOpts, EditorEventType } from './types';
export { jsonToMarkdown } from './jsonToMarkdown';
export { markdownToPlainText, markdownToBlocks, markdownToScreenplayBlocks, extractDialogueBySpeaker } from './markdownParser';
export type { InlineRun, MarkdownBlock, ScreenplayBlock } from './markdownParser';

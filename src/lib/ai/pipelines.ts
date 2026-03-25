export type PipelineInsertionMode = 'replace' | 'append' | 'side-by-side';

export interface PipelineStage {
  id: 'beat-to-scene' | 'expansion' | 'dialogue' | 'grammar' | 'tone';
  label: string;
  action: string;
  optional?: boolean;
  promptTemplate: string;
}

export interface PipelinePromptVariables {
  chapterText: string;
  currentDraft: string;
  userPrompt: string;
  toneReference: string;
}

export const AI_WRITING_PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'beat-to-scene',
    label: '1. Beat-to-scene draft',
    action: 'pipeline-beat-to-scene',
    promptTemplate: `Convert the material below into a strong scene draft.\n\nUser guidance:\n{{userPrompt}}\n\nSource beats/context:\n{{chapterText}}\n\nCurrent draft to improve:\n{{currentDraft}}\n\nOutput only the rewritten scene.`,
  },
  {
    id: 'expansion',
    label: '2. Expansion/details pass',
    action: 'pipeline-expansion',
    promptTemplate: `Expand the draft with concrete sensory details, emotional specificity, and clearer scene geography while preserving intent.\n\nCurrent draft:\n{{currentDraft}}\n\nOutput only the improved draft.`,
  },
  {
    id: 'dialogue',
    label: '3. Dialogue/voice pass',
    action: 'pipeline-dialogue',
    promptTemplate: `Improve dialogue and voice for character distinction, subtext, and rhythm while preserving plot beats.\n\nCurrent draft:\n{{currentDraft}}\n\nOutput only the improved draft.`,
  },
  {
    id: 'grammar',
    label: '4. Grammar/readability pass',
    action: 'pipeline-grammar',
    promptTemplate: `You are a proofreader. Fix every error in the draft below. Check for:
- Spelling mistakes
- Grammar errors (subject-verb agreement, tense consistency, pronoun reference)
- Punctuation (missing commas, incorrect apostrophes, run-on sentences)
- Repeated or missing words
- Homophones (their/there/they're, its/it's, your/you're, weather/whether, then/than)

Rules:
- Do NOT add new content or change the meaning
- Do NOT rephrase for style — only fix errors
- Preserve all character names, dialogue, and formatting

Current draft:
{{currentDraft}}

Output only the corrected draft with no commentary.`,
  },
  {
    id: 'tone',
    label: '5. Optional tone-matching pass',
    optional: true,
    action: 'pipeline-tone',
    promptTemplate: `Match the tone and voice reference while preserving content.\n\nTone reference:\n{{toneReference}}\n\nCurrent draft:\n{{currentDraft}}\n\nOutput only the rewritten draft.`,
  },
];

export function renderPipelinePrompt(template: string, variables: PipelinePromptVariables): string {
  return template
    .replaceAll('{{chapterText}}', variables.chapterText || 'N/A')
    .replaceAll('{{currentDraft}}', variables.currentDraft || variables.chapterText || '')
    .replaceAll('{{userPrompt}}', variables.userPrompt || 'No additional user guidance.')
    .replaceAll('{{toneReference}}', variables.toneReference || 'Keep tone aligned with existing chapter context.');
}

export function applyInsertionMode(base: string, incoming: string, mode: PipelineInsertionMode): string {
  const normalizedBase = base.trim();
  const normalizedIncoming = incoming.trim();

  if (mode === 'append') {
    return [normalizedBase, normalizedIncoming].filter(Boolean).join('\n\n');
  }

  if (mode === 'side-by-side') {
    return [
      '=== Original Draft ===',
      normalizedBase || '(empty)',
      '',
      '=== Candidate Revision ===',
      normalizedIncoming || '(empty)',
    ].join('\n');
  }

  return normalizedIncoming;
}

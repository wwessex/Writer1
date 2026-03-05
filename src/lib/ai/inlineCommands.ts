/**
 * Inline AI slash command definitions for the editor.
 *
 * These commands are triggered by typing `/` in the editor and selecting
 * from a floating command palette (similar to Notion's slash commands).
 * Each command pipes selected text through the AI provider pipeline.
 */

export interface InlineAICommand {
  id: string;
  label: string;
  icon: string;
  description: string;
  promptTemplate: string;
  requiresSelection: boolean;
}

export const INLINE_AI_COMMANDS: InlineAICommand[] = [
  {
    id: 'rewrite',
    label: 'Rewrite',
    icon: 'edit_note',
    description: 'Rewrite the selected text with improved clarity and flow',
    promptTemplate: 'Rewrite the following text to improve clarity, flow, and readability while preserving the original meaning and tone:\n\n{{selection}}',
    requiresSelection: true,
  },
  {
    id: 'continue',
    label: 'Continue Writing',
    icon: 'arrow_forward',
    description: 'Continue writing from the current position',
    promptTemplate: 'Continue writing naturally from where this text ends. Match the existing style, tone, and voice. Write 2-3 paragraphs:\n\n{{context}}',
    requiresSelection: false,
  },
  {
    id: 'simplify',
    label: 'Simplify',
    icon: 'compress',
    description: 'Simplify the selected text for easier reading',
    promptTemplate: 'Simplify the following text. Use shorter sentences, simpler vocabulary, and clearer structure while preserving the core meaning:\n\n{{selection}}',
    requiresSelection: true,
  },
  {
    id: 'enrich',
    label: 'Enrich',
    icon: 'auto_awesome',
    description: 'Add sensory details, imagery, and depth',
    promptTemplate: 'Enrich the following text with vivid sensory details, stronger imagery, and emotional depth. Do not change the plot or character actions:\n\n{{selection}}',
    requiresSelection: true,
  },
  {
    id: 'grammar',
    label: 'Fix Grammar',
    icon: 'spellcheck',
    description: 'Fix grammar, spelling, and punctuation',
    promptTemplate: 'Fix all grammar, spelling, and punctuation errors in the following text. Do not change the style or meaning:\n\n{{selection}}',
    requiresSelection: true,
  },
  {
    id: 'changePOV',
    label: 'Change POV',
    icon: 'person',
    description: 'Switch narrative perspective (1st/3rd person)',
    promptTemplate: 'Rewrite the following text, switching the narrative perspective. If it is in first person, convert to third person. If it is in third person, convert to first person. Preserve meaning and style:\n\n{{selection}}',
    requiresSelection: true,
  },
  {
    id: 'shorten',
    label: 'Shorten',
    icon: 'short_text',
    description: 'Make the text more concise',
    promptTemplate: 'Make the following text more concise. Remove unnecessary words and tighten the prose while keeping the essential meaning:\n\n{{selection}}',
    requiresSelection: true,
  },
  {
    id: 'dialogue',
    label: 'Improve Dialogue',
    icon: 'chat',
    description: 'Improve dialogue naturalness and voice',
    promptTemplate: 'Improve the dialogue in the following text. Make it sound more natural, add subtext, and ensure each character has a distinct voice:\n\n{{selection}}',
    requiresSelection: true,
  },
];

export function renderInlinePrompt(
  template: string,
  variables: { selection: string; context: string }
): string {
  return template
    .replaceAll('{{selection}}', variables.selection || '')
    .replaceAll('{{context}}', variables.context || '');
}

/**
 * Guided Book Flow: step-by-step wizard for writing a book from
 * idea to manuscript. Each phase feeds context into the next.
 */

export type GuidedFlowPhase =
  | 'concept'
  | 'research'
  | 'outline'
  | 'sample-chapter'
  | 'full-manuscript';

export interface GuidedFlowState {
  currentPhase: GuidedFlowPhase;
  concept: {
    genre: string;
    audience: string;
    logline: string;
    themes: string[];
    wordTarget: number;
  };
  research: {
    notes: string;
    references: string[];
  };
  outline: {
    chapters: { title: string; summary: string }[];
  };
  sampleChapter: {
    chapterIndex: number;
    content: string;
  };
  completedPhases: GuidedFlowPhase[];
}

export const GUIDED_FLOW_PHASES: { id: GuidedFlowPhase; label: string; icon: string; description: string }[] = [
  {
    id: 'concept',
    label: '1. Concept & Premise',
    icon: 'lightbulb',
    description: 'Define your genre, audience, logline, and themes.',
  },
  {
    id: 'research',
    label: '2. Research & World-Building',
    icon: 'explore',
    description: 'Gather references and build your story world.',
  },
  {
    id: 'outline',
    label: '3. AI-Assisted Outline',
    icon: 'format_list_numbered',
    description: 'Generate a chapter-by-chapter outline from your concept.',
  },
  {
    id: 'sample-chapter',
    label: '4. Sample Chapter',
    icon: 'edit_document',
    description: 'Draft a sample chapter to establish voice and style.',
  },
  {
    id: 'full-manuscript',
    label: '5. Full Manuscript',
    icon: 'menu_book',
    description: 'Expand the outline into a complete manuscript.',
  },
];

export const GUIDED_FLOW_PROMPTS: Record<GuidedFlowPhase, string> = {
  concept: '',
  research: `Based on the following book concept, suggest key research areas, reference materials, and world-building elements that the author should explore:

Genre: {{genre}}
Target Audience: {{audience}}
Logline: {{logline}}
Themes: {{themes}}

Provide a structured research guide with categories and specific items to investigate.`,

  outline: `Create a detailed chapter-by-chapter outline for a book based on the following:

Genre: {{genre}}
Target Audience: {{audience}}
Logline: {{logline}}
Themes: {{themes}}
Target Word Count: {{wordTarget}} words
Research Notes: {{research}}

For each chapter provide:
- Chapter title
- Brief summary (2-3 sentences)

Respond in JSON format: [{"title": "...", "summary": "..."}]`,

  'sample-chapter': `Write a compelling opening chapter based on this outline:

Genre: {{genre}}
Logline: {{logline}}
Chapter Title: {{chapterTitle}}
Chapter Summary: {{chapterSummary}}

Write approximately 2000-3000 words. Establish the voice, setting, and hook the reader.`,

  'full-manuscript': `Expand the following chapter outline into a full chapter draft:

Genre: {{genre}}
Chapter Title: {{chapterTitle}}
Chapter Summary: {{chapterSummary}}
Previous Context: {{previousContext}}

Write approximately {{targetWords}} words per chapter. Maintain consistent voice and pacing.`,
};

export function createInitialFlowState(): GuidedFlowState {
  return {
    currentPhase: 'concept',
    concept: {
      genre: '',
      audience: '',
      logline: '',
      themes: [],
      wordTarget: 50000,
    },
    research: {
      notes: '',
      references: [],
    },
    outline: {
      chapters: [],
    },
    sampleChapter: {
      chapterIndex: 0,
      content: '',
    },
    completedPhases: [],
  };
}

export function renderGuidedPrompt(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value || 'N/A');
  }
  return result;
}

const GUIDED_FLOW_STORAGE_KEY = 'draftharbour_guided_flow';

export function saveGuidedFlowState(state: GuidedFlowState): void {
  localStorage.setItem(GUIDED_FLOW_STORAGE_KEY, JSON.stringify(state));
}

export function loadGuidedFlowState(): GuidedFlowState | null {
  try {
    const raw = localStorage.getItem(GUIDED_FLOW_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearGuidedFlowState(): void {
  localStorage.removeItem(GUIDED_FLOW_STORAGE_KEY);
}

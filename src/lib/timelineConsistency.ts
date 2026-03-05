import type { Chapter, Scene, TimelineParadoxFinding, TimelineParadoxSeverity } from '@/types';
import { editorToPlainText } from '@/lib/utils';
import { getContinuityMemorySnapshot } from '@/lib/continuityMemory';

interface SceneContext {
  chapter: Chapter;
  scene: Scene;
  sceneOrder: number;
  sourceText: string;
  timestamp: number | null;
}

interface CharacterAgeState {
  character: string;
  age: number;
  scene: SceneContext;
}

interface PossessionState {
  object: string;
  holder: string;
  scene: SceneContext;
}

interface TravelState {
  character: string;
  location: string;
  time: number | null;
  scene: SceneContext;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const DATE_PATTERNS = [
  /\b(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/g,
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2}))?/g,
  /\b(?:on\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),\s*(\d{4})(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/gi
] as const;

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

function titleCase(raw: string): string {
  return raw.replace(/\b\w/g, c => c.toUpperCase());
}

function extractDateTimeReferences(text: string): number[] {
  const references: number[] = [];

  for (const match of text.matchAll(DATE_PATTERNS[0])) {
    const [, y, m, d, hh, mm] = match;
    const time = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh || 0), Number(mm || 0));
    if (!Number.isNaN(time)) references.push(time);
  }

  for (const match of text.matchAll(DATE_PATTERNS[1])) {
    const [, d, m, y, hh, mm] = match;
    const time = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh || 0), Number(mm || 0));
    if (!Number.isNaN(time)) references.push(time);
  }

  for (const match of text.matchAll(DATE_PATTERNS[2])) {
    const [, rawMonth, d, y, hh, mm, meridian] = match;
    const month = MONTHS[rawMonth.toLowerCase()];
    if (month === undefined) continue;
    let hour = Number(hh || 0);
    if (meridian?.toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (meridian?.toLowerCase() === 'am' && hour === 12) hour = 0;
    const time = Date.UTC(Number(y), month, Number(d), hour, Number(mm || 0));
    if (!Number.isNaN(time)) references.push(time);
  }

  return references.sort((a, b) => a - b);
}

function extractSceneTimestamp(scene: Scene, chapterText: string): number | null {
  const sceneMetadata = [scene.title, scene.summary, scene.slugLine, scene.tags.join(' ')].filter(Boolean).join(' ');
  const allDates = extractDateTimeReferences(`${sceneMetadata}\n${chapterText}`);
  return allDates[0] ?? null;
}

function extractSceneContexts(chapters: Chapter[]): SceneContext[] {
  return chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap(chapter => {
      const chapterText = editorToPlainText(chapter.content);
      const chapterDates = extractDateTimeReferences(`${chapter.title}\n${chapter.summary}\n${chapterText}`);
      const baseTime = chapterDates[0] ?? null;
      return (chapter.scenes || []).map((scene, index) => {
        const sceneText = [scene.title, scene.summary, scene.slugLine, scene.tags.join(' '), chapterText].filter(Boolean).join('\n');
        return {
          chapter,
          scene,
          sceneOrder: index,
          sourceText: sceneText,
          timestamp: extractSceneTimestamp(scene, chapterText) ?? baseTime
        } satisfies SceneContext;
      });
    });
}

function finding(
  severity: TimelineParadoxSeverity,
  type: TimelineParadoxFinding['type'],
  explanation: string,
  scenes: SceneContext[]
): TimelineParadoxFinding {
  return {
    id: `${type}-${scenes.map(s => `${s.chapter.id}:${s.scene.id}`).join('-')}`,
    severity,
    type,
    explanation,
    involvedChapterIds: [...new Set(scenes.map(s => s.chapter.id))],
    involvedSceneIds: [...new Set(scenes.map(s => s.scene.id))],
  };
}

function parseAgeMentions(text: string) {
  const mentions: Array<{ character: string; age: number }> = [];
  for (const match of text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is|was|aged)\s+(\d{1,3})\s*(?:years?\s*old)?\b/g)) {
    mentions.push({ character: normalizeName(match[1]), age: Number(match[2]) });
  }
  for (const match of text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+turns\s+(\d{1,3})\b/g)) {
    mentions.push({ character: normalizeName(match[1]), age: Number(match[2]) });
  }
  return mentions;
}

function parsePossessionMentions(text: string) {
  const transfers: Array<{ object: string; from?: string; to: string }> = [];
  for (const match of text.matchAll(/\b([A-Z][a-z]+)\s+gives\s+the\s+([a-z][a-z\s-]+?)\s+to\s+([A-Z][a-z]+)\b/g)) {
    transfers.push({ object: normalizeName(match[2]), from: normalizeName(match[1]), to: normalizeName(match[3]) });
  }
  for (const match of text.matchAll(/\b([A-Z][a-z]+)\s+(?:picks\s+up|takes|holds|carries|receives)\s+the\s+([a-z][a-z\s-]+)\b/g)) {
    transfers.push({ object: normalizeName(match[2]), to: normalizeName(match[1]) });
  }
  for (const match of text.matchAll(/\b([A-Z][a-z]+)\s+(?:drops|loses)\s+the\s+([a-z][a-z\s-]+)\b/g)) {
    transfers.push({ object: normalizeName(match[2]), from: normalizeName(match[1]), to: '' });
  }
  return transfers;
}

function parsePrerequisites(text: string) {
  const dependencies: Array<{ event: string; prereq: string }> = [];
  for (const match of text.matchAll(/\bevent:\s*([^\n;]+)\s+after:\s*([^\n;]+)/gi)) {
    dependencies.push({ event: normalizeName(match[1]), prereq: normalizeName(match[2]) });
  }
  return dependencies;
}

function parseEventLabels(text: string): string[] {
  const labels: string[] = [];
  for (const match of text.matchAll(/\bevent:\s*([^\n;]+)/gi)) {
    const cleaned = match[1].split(/\s+after:/i)[0];
    labels.push(normalizeName(cleaned));
  }
  return labels;
}

function parseTravelMentions(text: string) {
  const travels: Array<{ character: string; from: string; to: string; hours: number | null }> = [];
  for (const match of text.matchAll(/\b([A-Z][a-z]+)\s+travels\s+from\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?:\s+in\s+(\d+(?:\.\d+)?)\s+hours?)?\b/g)) {
    travels.push({
      character: normalizeName(match[1]),
      from: normalizeName(match[2]),
      to: normalizeName(match[3]),
      hours: match[4] ? Number(match[4]) : null,
    });
  }
  return travels;
}

export interface TimelineConsistencyResult {
  findings: TimelineParadoxFinding[];
  extractedTimelineCount: number;
}

export function analyzeTimelineConsistency(chapters: Chapter[], novelId = ''): TimelineConsistencyResult {
  const contexts = extractSceneContexts(chapters);
  const findings: TimelineParadoxFinding[] = [];

  const ageByCharacter = new Map<string, CharacterAgeState>();
  const possessionByObject = new Map<string, PossessionState>();
  const locationByCharacter = new Map<string, TravelState>();
  const eventToScene = new Map<string, SceneContext>();
  const pendingDependencies: Array<{ event: string; prereq: string; scene: SceneContext }> = [];

  const timeline = contexts
    .slice()
    .sort((a, b) => {
      if (a.timestamp !== null && b.timestamp !== null) return a.timestamp - b.timestamp;
      if (a.timestamp !== null) return -1;
      if (b.timestamp !== null) return 1;
      if (a.chapter.order !== b.chapter.order) return a.chapter.order - b.chapter.order;
      return a.sceneOrder - b.sceneOrder;
    });

  for (const ctx of timeline) {
    const mentions = parseAgeMentions(ctx.sourceText);
    for (const mention of mentions) {
      const previous = ageByCharacter.get(mention.character);
      if (previous && mention.age < previous.age) {
        findings.push(
          finding(
            'error',
            'age_regression',
            `${titleCase(mention.character)} is ${mention.age} in "${ctx.scene.title}", but was already ${previous.age} earlier.`,
            [previous.scene, ctx]
          )
        );
      }
      ageByCharacter.set(mention.character, { character: mention.character, age: mention.age, scene: ctx });
    }

    const possessions = parsePossessionMentions(ctx.sourceText);
    for (const possession of possessions) {
      const prev = possessionByObject.get(possession.object);
      if (possession.from && prev && prev.holder !== possession.from) {
        findings.push(
          finding(
            'error',
            'state_transition_conflict',
            `The ${possession.object} is transferred by ${titleCase(possession.from)}, but it was last held by ${titleCase(prev.holder)}.`,
            [prev.scene, ctx]
          )
        );
      }
      if (possession.to) {
        possessionByObject.set(possession.object, { object: possession.object, holder: possession.to, scene: ctx });
      }
    }

    const events = parseEventLabels(ctx.sourceText);
    for (const event of events) {
      eventToScene.set(event, ctx);
    }
    const dependencies = parsePrerequisites(ctx.sourceText);
    for (const dep of dependencies) {
      pendingDependencies.push({ ...dep, scene: ctx });
    }

    const travels = parseTravelMentions(ctx.sourceText);
    for (const travel of travels) {
      const previous = locationByCharacter.get(travel.character);
      const hasSceneTime = ctx.timestamp !== null;
      if (previous && hasSceneTime && previous.time !== null && previous.location !== travel.from) {
        findings.push(
          finding(
            'warning',
            'overlap_conflict',
            `${titleCase(travel.character)} departs from ${titleCase(travel.from)}, but was previously in ${titleCase(previous.location)}.`,
            [previous.scene, ctx]
          )
        );
      }
      if (travel.hours !== null && hasSceneTime && previous && previous.time !== null) {
        const elapsed = (ctx.timestamp as number) - previous.time;
        const minimum = travel.hours * HOUR_MS;
        if (elapsed < minimum) {
          findings.push(
            finding(
              'error',
              'travel_time_violation',
              `${titleCase(travel.character)} needs ${travel.hours}h to reach ${titleCase(travel.to)}, but only ${(elapsed / HOUR_MS).toFixed(1)}h elapsed.`,
              [previous.scene, ctx]
            )
          );
        }
      }
      locationByCharacter.set(travel.character, {
        character: travel.character,
        location: travel.to,
        time: ctx.timestamp,
        scene: ctx,
      });
    }

    if (ctx.scene.location && ctx.scene.pov) {
      const sceneCharacters = ctx.scene.pov.split(',').map(name => normalizeName(name)).filter(Boolean);
      for (const character of sceneCharacters) {
        const prev = locationByCharacter.get(character);
        if (prev && prev.time !== null && ctx.timestamp !== null && prev.location !== normalizeName(ctx.scene.location)) {
          const elapsed = ctx.timestamp - prev.time;
          if (elapsed < 2 * HOUR_MS) {
            findings.push(
              finding(
                'warning',
                'overlap_conflict',
                `${titleCase(character)} appears in ${ctx.scene.location} very soon after being in ${titleCase(prev.location)}.`,
                [prev.scene, ctx]
              )
            );
          }
        }
        locationByCharacter.set(character, {
          character,
          location: normalizeName(ctx.scene.location),
          time: ctx.timestamp,
          scene: ctx,
        });
      }
    }
  }

  for (const dep of pendingDependencies) {
    const eventScene = eventToScene.get(dep.event);
    const prereqScene = eventToScene.get(dep.prereq);
    if (!prereqScene) {
      findings.push(
        finding('warning', 'missing_prerequisite', `Event "${dep.event}" references missing prerequisite "${dep.prereq}".`, [dep.scene])
      );
      continue;
    }
    if (eventScene && prereqScene) {
      const eventIndex = timeline.indexOf(eventScene);
      const prereqIndex = timeline.indexOf(prereqScene);
      if (eventIndex <= prereqIndex) {
        findings.push(
          finding(
            'error',
            'prerequisite_order_violation',
            `Event "${dep.event}" occurs before prerequisite "${dep.prereq}".`,
            [eventScene, prereqScene]
          )
        );
      }
    }
  }


  if (novelId) {
    const continuity = getContinuityMemorySnapshot(novelId, chapters);
    for (const conflict of continuity.conflicts) {
      const chapter = chapters.find(candidate => candidate.id === conflict.chapterId);
      if (!chapter) continue;
      findings.push({
        id: `continuity-${conflict.id}`,
        severity: conflict.severity,
        type: 'continuity_conflict',
        explanation: conflict.message,
        involvedChapterIds: [conflict.chapterId],
        involvedSceneIds: (chapter.scenes || []).map(scene => scene.id),
      });
    }
  }

  return {
    findings,
    extractedTimelineCount: timeline.length,
  };
}

export function estimateTravelHours(from: string, to: string): number {
  if (normalizeName(from) === normalizeName(to)) return 0;
  const tokenDistance = Math.abs(normalizeName(from).length - normalizeName(to).length);
  return Math.max(1, Math.ceil(tokenDistance / 3));
}

export function inferRelativeDate(base: number, direction: 'before' | 'after', amount: number, unit: 'hours' | 'days'): number {
  const delta = unit === 'days' ? amount * DAY_MS : amount * HOUR_MS;
  return direction === 'after' ? base + delta : base - delta;
}

// Legacy storage adapters below support recovery and compatibility tests. Active views use synchronized operational state.
// Engagement pipeline (#361) — pure helpers for the Kanban board. Engagements
// are notes tagged `engagement/…`; their pipeline stage is a `stage/…` tag so
// the stage is visible on the note itself, not hidden in board state. The
// column set is configurable and persisted by the server-backed workspace store.

import type { CoreNote, CoreTag } from '@modulo/core';

export const ENGAGEMENT_TAG_PREFIX = 'engagement/';
export const STAGE_TAG_PREFIX = 'stage/';

/** Default audit pipeline, in column order. */
export const DEFAULT_STAGES = ['inquiry', 'scoping', 'audit', 'report', 'fix-review', 'final'];

export function isEngagement(note: CoreNote): boolean {
  const kind=note.tags.find(tag=>tag.name.startsWith("audit/record/"));
  return (!kind||kind.name==="audit/record/engagement")&&note.tags.some((t) => t.name.startsWith(ENGAGEMENT_TAG_PREFIX));
}

export function engagementLabel(note: CoreNote): string | null {
  const tag = note.tags.find((t) => t.name.startsWith(ENGAGEMENT_TAG_PREFIX));
  return tag ? tag.name.slice(ENGAGEMENT_TAG_PREFIX.length) : null;
}

/** The note's current `stage/…` tag, if any. */
export function stageTag(note: CoreNote): CoreTag | undefined {
  return note.tags.find((t) => t.name.startsWith(STAGE_TAG_PREFIX));
}

export function stageOf(note: CoreNote): string | null {
  const tag = stageTag(note);
  return tag ? tag.name.slice(STAGE_TAG_PREFIX.length) : null;
}

/** Engagements grouped into columns. Unstaged (or unknown-stage) engagements
 *  land in the first column so nothing silently disappears from the board. */
export function groupByStage(notes: CoreNote[], stages: string[]): Record<string, CoreNote[]> {
  const groups: Record<string, CoreNote[]> = Object.fromEntries(stages.map((s) => [s, []]));
  for (const note of notes) {
    if (!isEngagement(note)) continue;
    const stage = stageOf(note);
    const column = stage && stages.includes(stage) ? stage : stages[0];
    if (column !== undefined) groups[column].push(note);
  }
  return groups;
}

// ── Column-set persistence ───────────────────────────────────────────────────

export const PIPELINE_STAGES_KEY = 'modulo-pipeline-stages';

export function parseStages(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(stage => typeof stage === 'string')) {
    return [...DEFAULT_STAGES];
  }
  const stages = value.map(stage => stage.trim()).filter(Boolean);
  return stages.length > 0 ? [...new Set(stages)] : [...DEFAULT_STAGES];
}

/** Normalise a user-entered column name to a stage id (`Fix Review` → `fix-review`). */
export function toStageId(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

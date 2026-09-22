import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';

export const INFORMATION_INTAKE_STORE_KEY = 'modulo-information-intake-v1';

export const INTAKE_MODES = ['Awareness', 'Exploration', 'Deep Research', 'Decision Support', 'Problem-Solving', 'Creation', 'Externalization', 'Internalization', 'Iteration', 'Maintenance'] as const;
export type IntakeMode = typeof INTAKE_MODES[number];
export const INTAKE_STATUSES = ['Inbox', 'Planned', 'Active', 'Done', 'Discarded'] as const;
export type IntakeStatus = typeof INTAKE_STATUSES[number];
export const SESSION_STATUSES = ['Planned', 'Done', 'Skipped'] as const;
export type IntakeSessionStatus = typeof SESSION_STATUSES[number];
export const ARTIFACT_STATUSES = ['Draft', 'Stable', 'Archived'] as const;
export type IntakeArtifactStatus = typeof ARTIFACT_STATUSES[number];
export const ARTIFACT_TYPES = ['Signal', 'Exploration Note', 'Research Bundle', 'Decision Record', 'Comparative Matrix', 'Solution Note', 'Creation', 'Playbook', 'Template', 'Configuration', 'Retrieval Pack', 'Iteration Log', 'Maintenance Review'] as const;
export type IntakeArtifactType = typeof ARTIFACT_TYPES[number];
export const SOURCE_TIERS = ['Trusted', 'Watch', 'Unknown', 'Muted'] as const;
export type SourceTier = typeof SOURCE_TIERS[number];
export const SIGNAL_DECISIONS = ['Untriaged', 'Watch', 'Escalate', 'Schedule', 'Discard'] as const;
export type SignalDecision = typeof SIGNAL_DECISIONS[number];

export interface IntakeModeDefinition {
  mode: IntakeMode;
  question: string;
  intent: string;
  output: string;
  cadence: string;
  doneWhen: string;
  success: string;
  defaultMinutes?: number;
}

export const INTAKE_MODE_DEFINITIONS: IntakeModeDefinition[] = [
  { mode: 'Awareness', question: "What's happening? What's changing?", intent: 'Scan quickly and separate signal from noise.', output: 'Updated mental model or escalation', cadence: 'Daily · 15 min', doneWhen: 'Everything was touched and decided.', success: 'Important signals are caught in under two hours per week.', defaultMinutes: 15 },
  { mode: 'Exploration', question: "What's down this rabbit hole?", intent: 'Follow curiosity without pretending it has a deliverable.', output: 'Discovery or escalation', cadence: 'Weekly · 60–120 min', doneWhen: "The timebox ends or something deserves escalation.", success: 'Unexpected connections appear and time stays bounded.', defaultMinutes: 90 },
  { mode: 'Deep Research', question: 'What is known, and how confident should I be?', intent: 'Build structured understanding of a bounded topic.', output: 'Evidence, concepts, claims, brief, model, and maps', cadence: 'Deep-work sessions · ≤3 active topics', doneWhen: 'Known, uncertain, and unresolved are clearly articulated.', success: 'Topics reach their definition of done.', defaultMinutes: 120 },
  { mode: 'Decision Support', question: 'Should I do this or choose one option over another?', intent: 'Gather only enough evidence to make a sound choice.', output: 'Decision record and optional comparative matrix', cadence: 'Triggered by a pending decision', doneWhen: 'The decision and rationale are recorded.', success: 'Decisions get made instead of becoming research projects.', defaultMinutes: 60 },
  { mode: 'Problem-Solving', question: 'How do I fix this and get unstuck?', intent: 'Resolve a live blocker with speed over completeness.', output: 'Working fix and optional reusable solution', cadence: 'On demand', doneWhen: 'It works and the blocker is gone.', success: 'Resolution is fast; reusable fixes are captured.', defaultMinutes: 45 },
  { mode: 'Creation', question: 'What am I making, and what must it become?', intent: 'Synthesize knowledge into something shippable.', output: 'Finished artifact', cadence: 'Project driven', doneWhen: 'The artifact exists and meets its purpose.', success: 'Drafts become shipped work.', defaultMinutes: 120 },
  { mode: 'Externalization', question: 'How can this work without me remembering it?', intent: 'Encode knowledge into trusted systems and procedures.', output: 'Playbook, script, template, checklist, or configuration', cadence: 'After solving, creating, or researching', doneWhen: 'It can be found and followed without memory.', success: 'Procedures still work months later.', defaultMinutes: 60 },
  { mode: 'Internalization', question: 'Can I execute or teach this without looking it up?', intent: 'Build fluent recall and embodied skill.', output: 'Retrieval pack and demonstrated capability', cadence: 'Ongoing practice', doneWhen: 'Recall and execution no longer require notes.', success: 'The skill can be executed and taught without preparation.', defaultMinutes: 30 },
  { mode: 'Iteration', question: 'Did it work, and what should change?', intent: 'Apply, measure, and refine using real feedback.', output: 'Improved artifact or corrected mental model', cadence: 'Embedded in use', doneWhen: 'Changes diminish and the artifact is stable.', success: 'Reality-testing continuously improves the work.', defaultMinutes: 45 },
  { mode: 'Maintenance', question: "What's stale, broken, or ready to prune?", intent: 'Keep sources, artifacts, and workflows healthy.', output: 'Updated system with cruft removed', cadence: 'Monthly · 30–60 min', doneWhen: 'The checklist is complete and health is acceptable.', success: 'The system stays usable instead of accumulating clutter.', defaultMinutes: 45 },
];

export interface IntakeItem {
  id: string;
  title: string;
  url?: string;
  reason?: string;
  sourceTier?: SourceTier;
  signalDecision?: SignalDecision;
  mode?: IntakeMode;
  status: IntakeStatus;
  desiredOutcome?: string;
  scheduledDate?: string;
  durationMinutes?: number;
  blockId?: DayBlockId;
  nextMode?: IntakeMode;
  outputSummary?: string;
  projectId?: string;
  areaId?: string;
  tags: string[];
  capturedAt: string;
  lastTouchedAt: string;
}

export interface IntakeSession {
  id: string;
  itemId?: string;
  mode: IntakeMode;
  date: string;
  durationMinutes: number;
  blockId?: DayBlockId;
  status: IntakeSessionStatus;
  outcome?: string;
}

export interface IntakeArtifact {
  id: string;
  itemId?: string;
  mode: IntakeMode;
  type: IntakeArtifactType;
  title: string;
  body?: string;
  status: IntakeArtifactStatus;
  reviewDate?: string;
  projectId?: string;
  areaId?: string;
  sourceUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export const RESEARCH_PROJECT_STATUSES = ['Scoping', 'Active', 'Synthesis', 'Blocked', 'Paused', 'Complete'] as const;
export type ResearchProjectStatus = typeof RESEARCH_PROJECT_STATUSES[number];
export const RESEARCH_WORK_STATUSES = ['Open', 'Active', 'Blocked', 'Review', 'Complete', 'Parked'] as const;
export type ResearchWorkStatus = typeof RESEARCH_WORK_STATUSES[number];

export interface ResearchProject {
  id: string;
  title: string;
  question: string;
  scope?: string;
  definitionOfDone?: string;
  status: ResearchProjectStatus;
  currentMode: IntakeMode;
  nextMode?: IntakeMode;
  noteIds: number[];
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** A bounded path through sources during Exploration. Links are references,
 * not copied source data, so the Evidence Lab remains the source of truth. */
export interface ExplorationTrail {
  id: string;
  projectId?: string;
  itemId?: string;
  title: string;
  status: ResearchWorkStatus;
  timeboxMinutes: number;
  links: string[];
  connections: string[];
  parkingLot: string[];
  outcome?: string;
  updatedAt: string;
}

export interface ResearchSynthesis {
  id: string;
  projectId?: string;
  title: string;
  status: ResearchWorkStatus;
  sourceIds: string[];
  claimIds: string[];
  known?: string;
  uncertain?: string;
  unresolved?: string;
  contradictions?: string;
  confidence: 'Low' | 'Medium' | 'High';
  brief?: string;
  updatedAt: string;
}

export interface ResearchCase {
  id: string;
  projectId?: string;
  kind: 'Decision' | 'Problem';
  title: string;
  status: ResearchWorkStatus;
  criteria?: string;
  optionsOrHypotheses?: string;
  evidence?: string;
  rationale?: string;
  verification?: string;
  revisitTrigger?: string;
  updatedAt: string;
}

export interface ResearchCreation {
  id: string;
  projectId?: string;
  kind: 'Creation' | 'Externalization';
  title: string;
  status: ResearchWorkStatus;
  purpose?: string;
  audience?: string;
  acceptanceCriteria?: string;
  feedback?: string;
  validation?: string;
  artifactId?: string;
  noteId?: number;
  reviewDate?: string;
  updatedAt: string;
}

export interface ResearchLearningPlan {
  id: string;
  projectId?: string;
  title: string;
  status: ResearchWorkStatus;
  capability?: string;
  retrievalPrompts?: string;
  practiceConditions?: string;
  demonstrationTest?: string;
  educationNodeId?: string;
  nextReview?: string;
  updatedAt: string;
}

export interface ResearchExperiment {
  id: string;
  projectId?: string;
  title: string;
  status: ResearchWorkStatus;
  hypothesis?: string;
  baseline?: string;
  change?: string;
  observation?: string;
  metric?: string;
  result?: string;
  rollback?: string;
  versionRef?: string;
  updatedAt: string;
}

export interface ResearchMaintenanceReview {
  id: string;
  projectId?: string;
  title: string;
  status: ResearchWorkStatus;
  reviewDate: string;
  policy?: string;
  staleReviewed?: string;
  brokenLinks?: string;
  duplicates?: string;
  orphans?: string;
  actions?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface ResearchTransition {
  id: string;
  itemId?: string;
  projectId?: string;
  fromMode?: IntakeMode;
  toMode: IntakeMode;
  reason?: string;
  artifactId?: string;
  createdAt: string;
}

export interface InformationIntakeData {
  version: 1;
  items: IntakeItem[];
  sessions: IntakeSession[];
  artifacts: IntakeArtifact[];
  projects: ResearchProject[];
  explorationTrails: ExplorationTrail[];
  syntheses: ResearchSynthesis[];
  cases: ResearchCase[];
  creations: ResearchCreation[];
  learningPlans: ResearchLearningPlan[];
  experiments: ResearchExperiment[];
  maintenanceReviews: ResearchMaintenanceReview[];
  transitions: ResearchTransition[];
}

export interface ModeRouteAnswers {
  urgentOrBroken?: boolean;
  curiosityOnly?: boolean;
  decisionNeeded?: boolean;
  systematicUnderstanding?: boolean;
  creating?: boolean;
  stayingCurrent?: boolean;
  externalize?: boolean;
  internalize?: boolean;
  iterating?: boolean;
  maintenance?: boolean;
}

export const emptyInformationIntake = (): InformationIntakeData => ({ version: 1, items: [], sessions: [], artifacts: [], projects: [], explorationTrails: [], syntheses: [], cases: [], creations: [], learningPlans: [], experiments: [], maintenanceReviews: [], transitions: [] });
export const newInformationIntakeId = (prefix: 'intake' | 'session' | 'artifact' | 'project' | 'trail' | 'synthesis' | 'case' | 'creation' | 'learning' | 'experiment' | 'review' | 'transition'): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalText = (value: unknown): string | undefined => text(value) || undefined;
const strings = (value: unknown): string[] => array(value).filter((item): item is string => typeof item === 'string' && item.length > 0);
const finite = (value: unknown): number | undefined => Number.isFinite(Number(value)) ? Number(value) : undefined;
const numbers = (value: unknown): number[] => array(value).filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
const choice = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
const optionalChoice = <T extends string>(value: unknown, values: readonly T[]): T | undefined => values.includes(value as T) ? value as T : undefined;
const optionalMode = (value: unknown): IntakeMode | undefined => INTAKE_MODES.includes(value as IntakeMode) ? value as IntakeMode : undefined;
const blockId = (value: unknown): DayBlockId | undefined => DAY_BLOCKS.some((block) => block.id === value) ? value as DayBlockId : undefined;

export function parseInformationIntake(value: unknown): InformationIntakeData {
  const raw = object(value);
  return {
    version: 1,
    items: array(raw.items).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), title: text(item.title), url: optionalText(item.url), reason: optionalText(item.reason), sourceTier: optionalChoice(item.sourceTier, SOURCE_TIERS), signalDecision: optionalChoice(item.signalDecision, SIGNAL_DECISIONS), mode: optionalMode(item.mode),
      status: choice(item.status, INTAKE_STATUSES, 'Inbox'), desiredOutcome: optionalText(item.desiredOutcome), scheduledDate: optionalText(item.scheduledDate),
      durationMinutes: finite(item.durationMinutes) && Number(item.durationMinutes) > 0 ? Number(item.durationMinutes) : undefined,
      blockId: blockId(item.blockId), nextMode: optionalMode(item.nextMode), outputSummary: optionalText(item.outputSummary), projectId: optionalText(item.projectId), areaId: optionalText(item.areaId),
      tags: strings(item.tags), capturedAt: text(item.capturedAt) || new Date(0).toISOString(), lastTouchedAt: text(item.lastTouchedAt) || text(item.capturedAt) || new Date(0).toISOString(),
    })),
    sessions: array(raw.sessions).map(object).filter((item) => text(item.id) && text(item.date)).map((item) => ({
      id: text(item.id), itemId: optionalText(item.itemId), mode: choice(item.mode, INTAKE_MODES, 'Awareness'), date: text(item.date),
      durationMinutes: Math.max(0, finite(item.durationMinutes) ?? 0), blockId: blockId(item.blockId), status: choice(item.status, SESSION_STATUSES, 'Planned'), outcome: optionalText(item.outcome),
    })),
    artifacts: array(raw.artifacts).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), itemId: optionalText(item.itemId), mode: choice(item.mode, INTAKE_MODES, 'Deep Research'), type: choice(item.type, ARTIFACT_TYPES, 'Research Bundle'),
      title: text(item.title), body: optionalText(item.body), status: choice(item.status, ARTIFACT_STATUSES, 'Draft'), reviewDate: optionalText(item.reviewDate), projectId: optionalText(item.projectId), areaId: optionalText(item.areaId),
      sourceUrls: strings(item.sourceUrls), createdAt: text(item.createdAt) || new Date(0).toISOString(), updatedAt: text(item.updatedAt) || text(item.createdAt) || new Date(0).toISOString(),
    })),
    projects: array(raw.projects).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), title: text(item.title), question: text(item.question), scope: optionalText(item.scope), definitionOfDone: optionalText(item.definitionOfDone),
      status: choice(item.status, RESEARCH_PROJECT_STATUSES, 'Scoping'), currentMode: choice(item.currentMode, INTAKE_MODES, 'Exploration'), nextMode: optionalMode(item.nextMode),
      noteIds: numbers(item.noteIds), sourceIds: strings(item.sourceIds), createdAt: text(item.createdAt) || new Date(0).toISOString(), updatedAt: text(item.updatedAt) || text(item.createdAt) || new Date(0).toISOString(),
    })),
    explorationTrails: array(raw.explorationTrails).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), projectId: optionalText(item.projectId), itemId: optionalText(item.itemId), title: text(item.title), status: choice(item.status, RESEARCH_WORK_STATUSES, 'Open'),
      timeboxMinutes: Math.max(1, finite(item.timeboxMinutes) ?? 60), links: strings(item.links), connections: strings(item.connections), parkingLot: strings(item.parkingLot), outcome: optionalText(item.outcome), updatedAt: text(item.updatedAt) || new Date(0).toISOString(),
    })),
    syntheses: array(raw.syntheses).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), projectId: optionalText(item.projectId), title: text(item.title), status: choice(item.status, RESEARCH_WORK_STATUSES, 'Open'), sourceIds: strings(item.sourceIds), claimIds: strings(item.claimIds),
      known: optionalText(item.known), uncertain: optionalText(item.uncertain), unresolved: optionalText(item.unresolved), contradictions: optionalText(item.contradictions), confidence: choice(item.confidence, ['Low', 'Medium', 'High'] as const, 'Low'), brief: optionalText(item.brief), updatedAt: text(item.updatedAt) || new Date(0).toISOString(),
    })),
    cases: array(raw.cases).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), projectId: optionalText(item.projectId), kind: choice(item.kind, ['Decision', 'Problem'] as const, 'Decision'), title: text(item.title), status: choice(item.status, RESEARCH_WORK_STATUSES, 'Open'),
      criteria: optionalText(item.criteria), optionsOrHypotheses: optionalText(item.optionsOrHypotheses), evidence: optionalText(item.evidence), rationale: optionalText(item.rationale), verification: optionalText(item.verification), revisitTrigger: optionalText(item.revisitTrigger), updatedAt: text(item.updatedAt) || new Date(0).toISOString(),
    })),
    creations: array(raw.creations).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), projectId: optionalText(item.projectId), kind: choice(item.kind, ['Creation', 'Externalization'] as const, 'Creation'), title: text(item.title), status: choice(item.status, RESEARCH_WORK_STATUSES, 'Open'),
      purpose: optionalText(item.purpose), audience: optionalText(item.audience), acceptanceCriteria: optionalText(item.acceptanceCriteria), feedback: optionalText(item.feedback), validation: optionalText(item.validation), artifactId: optionalText(item.artifactId), noteId: finite(item.noteId), reviewDate: optionalText(item.reviewDate), updatedAt: text(item.updatedAt) || new Date(0).toISOString(),
    })),
    learningPlans: array(raw.learningPlans).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), projectId: optionalText(item.projectId), title: text(item.title), status: choice(item.status, RESEARCH_WORK_STATUSES, 'Open'), capability: optionalText(item.capability), retrievalPrompts: optionalText(item.retrievalPrompts), practiceConditions: optionalText(item.practiceConditions), demonstrationTest: optionalText(item.demonstrationTest), educationNodeId: optionalText(item.educationNodeId), nextReview: optionalText(item.nextReview), updatedAt: text(item.updatedAt) || new Date(0).toISOString(),
    })),
    experiments: array(raw.experiments).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), projectId: optionalText(item.projectId), title: text(item.title), status: choice(item.status, RESEARCH_WORK_STATUSES, 'Open'), hypothesis: optionalText(item.hypothesis), baseline: optionalText(item.baseline), change: optionalText(item.change), observation: optionalText(item.observation), metric: optionalText(item.metric), result: optionalText(item.result), rollback: optionalText(item.rollback), versionRef: optionalText(item.versionRef), updatedAt: text(item.updatedAt) || new Date(0).toISOString(),
    })),
    maintenanceReviews: array(raw.maintenanceReviews).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), projectId: optionalText(item.projectId), title: text(item.title), status: choice(item.status, RESEARCH_WORK_STATUSES, 'Open'), reviewDate: text(item.reviewDate), policy: optionalText(item.policy), staleReviewed: optionalText(item.staleReviewed), brokenLinks: optionalText(item.brokenLinks), duplicates: optionalText(item.duplicates), orphans: optionalText(item.orphans), actions: optionalText(item.actions), completedAt: optionalText(item.completedAt), updatedAt: text(item.updatedAt) || new Date(0).toISOString(),
    })),
    transitions: array(raw.transitions).map(object).filter((item) => text(item.id) && optionalMode(item.toMode)).map((item) => ({
      id: text(item.id), itemId: optionalText(item.itemId), projectId: optionalText(item.projectId), fromMode: optionalMode(item.fromMode), toMode: choice(item.toMode, INTAKE_MODES, 'Awareness'), reason: optionalText(item.reason), artifactId: optionalText(item.artifactId), createdAt: text(item.createdAt) || new Date(0).toISOString(),
    })),
  };
}

export function routeInformationMode(answers: ModeRouteAnswers): IntakeMode {
  if (answers.urgentOrBroken) return 'Problem-Solving';
  if (answers.curiosityOnly) return 'Exploration';
  if (answers.decisionNeeded) return 'Decision Support';
  if (answers.systematicUnderstanding) return 'Deep Research';
  if (answers.creating) return 'Creation';
  if (answers.stayingCurrent) return 'Awareness';
  if (answers.externalize) return 'Externalization';
  if (answers.internalize) return 'Internalization';
  if (answers.iterating) return 'Iteration';
  if (answers.maintenance) return 'Maintenance';
  return 'Awareness';
}

export function defaultArtifactType(mode: IntakeMode): IntakeArtifactType {
  const types: Record<IntakeMode, IntakeArtifactType> = {
    Awareness: 'Signal', Exploration: 'Exploration Note', 'Deep Research': 'Research Bundle', 'Decision Support': 'Decision Record',
    'Problem-Solving': 'Solution Note', Creation: 'Creation', Externalization: 'Playbook', Internalization: 'Retrieval Pack',
    Iteration: 'Iteration Log', Maintenance: 'Maintenance Review',
  };
  return types[mode];
}

export function artifactTemplate(type: IntakeArtifactType): string {
  const templates: Record<IntakeArtifactType, string> = {
    Signal: '## Signal\n\n## Why it matters\n\n## Escalate or discard?\n',
    'Exploration Note': '## Unexpected connections\n\n## Worth escalating\n\n## Parking lot\n',
    'Research Bundle': '## Scope and definition of done\n\n## Sources\n\n## Evidence cards\n\n## Concepts\n\n## Claim ledger\n\n## Open questions\n\n## L1 brief\n\n## Mental model\n\n## Maps\n',
    'Decision Record': '## Decision\n\n## Context and constraints\n\n## Options considered\n\n## Evidence\n\n## Rationale\n\n## Risks and mitigations\n\n## Revisit triggers\n',
    'Comparative Matrix': '## Options\n\n## Criteria and weights\n\n## Scores and evidence\n\n## Result\n',
    'Solution Note': '## Problem\n\n## Reproduction\n\n## Fix\n\n## Verification\n\n## Reuse conditions\n',
    Creation: '## Purpose and audience\n\n## Acceptance criteria\n\n## Draft\n\n## Ship checklist\n',
    Playbook: '## Trigger\n\n## Preconditions\n\n## Procedure\n\n## Verification\n\n## Recovery\n',
    Template: '## When to use\n\n## Inputs\n\n## Template\n\n## Completion check\n',
    Configuration: '## Purpose\n\n## Configuration\n\n## Validation\n\n## Maintenance notes\n',
    'Retrieval Pack': '## Capability\n\n## Retrieval prompts\n\n## Practice conditions\n\n## Demonstration test\n',
    'Iteration Log': '## Applied change\n\n## Observed result\n\n## Gap found\n\n## Next revision\n',
    'Maintenance Review': '## Stale items reviewed\n\n## Updated\n\n## Archived or deleted\n\n## System health\n',
  };
  return templates[type];
}

export function activeDeepResearchCount(data: InformationIntakeData): number {
  return data.items.filter((item) => item.mode === 'Deep Research' && item.status === 'Active').length;
}

export function canActivateItem(data: InformationIntakeData, item: IntakeItem): boolean {
  return item.mode !== 'Deep Research' || item.status === 'Active' || activeDeepResearchCount(data) < 3;
}

export function sessionsOn(data: InformationIntakeData, date: string): IntakeSession[] {
  const order = (id: DayBlockId | undefined) => id ? DAY_BLOCKS.findIndex((block) => block.id === id) : DAY_BLOCKS.length;
  return data.sessions.filter((session) => session.date === date).sort((a, b) => order(a.blockId) - order(b.blockId));
}

export function minutesBetween(data: InformationIntakeData, mode: IntakeMode, start: string, end: string): number {
  return data.sessions.filter((session) => session.mode === mode && session.status === 'Done' && session.date >= start && session.date <= end).reduce((total, session) => total + session.durationMinutes, 0);
}

export function staleArtifacts(data: InformationIntakeData, today: string): IntakeArtifact[] {
  return data.artifacts.filter((artifact) => artifact.status !== 'Archived' && artifact.reviewDate && artifact.reviewDate <= today).sort((a, b) => (a.reviewDate ?? '').localeCompare(b.reviewDate ?? ''));
}

export function removeIntakeItem(data: InformationIntakeData, id: string): InformationIntakeData {
  return { ...data, items: data.items.filter((item) => item.id !== id), sessions: data.sessions.filter((session) => session.itemId !== id), artifacts: data.artifacts.map((artifact) => artifact.itemId === id ? { ...artifact, itemId: undefined } : artifact) };
}

export const MODE_EXIT_CRITERIA: Record<IntakeMode, string[]> = {
  Awareness: ['Signal was classified', 'Escalate, schedule, discard, or watch was chosen'],
  Exploration: ['Timebox ended', 'Connections and parking-lot items were captured'],
  'Deep Research': ['Known, uncertain, and unresolved are explicit', 'Claims reference evidence'],
  'Decision Support': ['Choice and rationale are recorded', 'Revisit trigger is defined'],
  'Problem-Solving': ['Fix was verified', 'Reusable learning was captured'],
  Creation: ['Acceptance criteria are met', 'Artifact is shipped or handed off'],
  Externalization: ['Procedure can be found and followed', 'Validation or recovery step exists'],
  Internalization: ['Retrieval practice is scheduled', 'Capability can be demonstrated'],
  Iteration: ['Observed result is recorded', 'Keep, revise, or roll back was chosen'],
  Maintenance: ['Stale and broken references were reviewed', 'Next review is scheduled'],
};

export function suggestedNextMode(mode: IntakeMode, outcome = ''): IntakeMode | undefined {
  const normalized = outcome.toLowerCase();
  if (normalized.includes('decision')) return 'Decision Support';
  if (normalized.includes('problem') || normalized.includes('blocked')) return 'Problem-Solving';
  const next: Record<IntakeMode, IntakeMode | undefined> = {
    Awareness: 'Exploration', Exploration: 'Deep Research', 'Deep Research': 'Creation', 'Decision Support': 'Externalization',
    'Problem-Solving': 'Externalization', Creation: 'Externalization', Externalization: 'Internalization', Internalization: 'Iteration',
    Iteration: 'Maintenance', Maintenance: undefined,
  };
  return next[mode];
}

/** Moves an intake item and/or project while retaining an auditable workflow
 * history. The optional artifact reference closes the provenance chain. */
export function transitionResearch(
  data: InformationIntakeData,
  target: { itemId?: string; projectId?: string },
  toMode: IntakeMode,
  reason?: string,
  artifactId?: string,
  now = new Date().toISOString(),
): InformationIntakeData {
  const item = target.itemId ? data.items.find((candidate) => candidate.id === target.itemId) : undefined;
  const project = target.projectId ? data.projects.find((candidate) => candidate.id === target.projectId) : undefined;
  const fromMode = item?.mode ?? project?.currentMode;
  return {
    ...data,
    items: data.items.map((candidate) => candidate.id === target.itemId ? { ...candidate, mode: toMode, nextMode: suggestedNextMode(toMode), lastTouchedAt: now } : candidate),
    projects: data.projects.map((candidate) => candidate.id === target.projectId ? { ...candidate, currentMode: toMode, nextMode: suggestedNextMode(toMode), updatedAt: now } : candidate),
    transitions: [...data.transitions, { id: newInformationIntakeId('transition'), itemId: target.itemId, projectId: target.projectId, fromMode, toMode, reason, artifactId, createdAt: now }],
  };
}

export function projectProvenance(data: InformationIntakeData, projectId: string) {
  const itemIds = new Set(data.items.filter((item) => item.projectId === projectId).map((item) => item.id));
  const artifacts = data.artifacts.filter((artifact) => artifact.projectId === projectId || (artifact.itemId && itemIds.has(artifact.itemId)));
  return {
    items: itemIds.size,
    sessions: data.sessions.filter((session) => session.itemId && itemIds.has(session.itemId)).length,
    artifacts: artifacts.length,
    sources: new Set([...data.projects.find((project) => project.id === projectId)?.sourceIds ?? [], ...artifacts.flatMap((artifact) => artifact.sourceUrls)]).size,
    transitions: data.transitions.filter((transition) => transition.projectId === projectId || (transition.itemId && itemIds.has(transition.itemId))).length,
  };
}

import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';

export const EDUCATION_STORE_KEY = 'modulo-education-v1';

export const LEARNING_NODE_TYPES = ['Program', 'Course', 'Module', 'Lesson', 'Activity'] as const;
export type LearningNodeType = typeof LEARNING_NODE_TYPES[number];
export const LEARNING_STATUSES = ['Planned', 'Active', 'Paused', 'Completed', 'Dropped'] as const;
export type LearningStatus = typeof LEARNING_STATUSES[number];
export const SESSION_STATUSES = ['Planned', 'Done', 'Skipped'] as const;
export type SessionStatus = typeof SESSION_STATUSES[number];
export const ASSIGNMENT_TYPES = ['Assignment', 'Exercise', 'Exam', 'Project'] as const;
export type AssignmentType = typeof ASSIGNMENT_TYPES[number];
export const ASSIGNMENT_STATUSES = ['Not Started', 'In Progress', 'Submitted', 'Graded'] as const;
export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[number];

export interface LearningNode {
  id: string;
  parentId?: string;
  type: LearningNodeType;
  title: string;
  status: LearningStatus;
  subject?: string;
  provider?: string;
  instructor?: string;
  startDate?: string;
  targetDate?: string;
  sourceUrl?: string;
  notes?: string;
  projectId?: string;
  areaId?: string;
  goalId?: string;
}

export interface StudySession {
  id: string;
  nodeId: string;
  date: string;
  durationMinutes: number;
  blockId?: DayBlockId;
  status: SessionStatus;
  notes?: string;
}

export interface EducationAssignment {
  id: string;
  nodeId: string;
  title: string;
  type: AssignmentType;
  status: AssignmentStatus;
  dueDate?: string;
  submittedAt?: string;
  score?: number;
  maxScore?: number;
  feedback?: string;
}

export interface EducationData {
  version: 1;
  nodes: LearningNode[];
  sessions: StudySession[];
  assignments: EducationAssignment[];
}

export const emptyEducation = (): EducationData => ({ version: 1, nodes: [], sessions: [], assignments: [] });

const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const choice = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;
const blockId = (value: unknown): DayBlockId | undefined => DAY_BLOCKS.some((block) => block.id === value) ? value as DayBlockId : undefined;

export function parseEducation(value: unknown): EducationData {
  const raw = record(value);
  return {
    version: 1,
    nodes: array(raw.nodes).map(record).filter((node) => string(node.id) && string(node.title)).map((node) => ({
      id: string(node.id),
      parentId: string(node.parentId) || undefined,
      type: choice(node.type, LEARNING_NODE_TYPES, 'Course'),
      title: string(node.title),
      status: choice(node.status, LEARNING_STATUSES, 'Planned'),
      subject: string(node.subject) || undefined,
      provider: string(node.provider) || undefined,
      instructor: string(node.instructor) || undefined,
      startDate: string(node.startDate) || undefined,
      targetDate: string(node.targetDate) || undefined,
      sourceUrl: string(node.sourceUrl) || undefined,
      notes: string(node.notes) || undefined,
      projectId: string(node.projectId) || undefined,
      areaId: string(node.areaId) || undefined,
      goalId: string(node.goalId) || undefined,
    })),
    sessions: array(raw.sessions).map(record).filter((session) => string(session.id) && string(session.nodeId) && string(session.date)).map((session) => ({
      id: string(session.id),
      nodeId: string(session.nodeId),
      date: string(session.date),
      durationMinutes: Math.max(0, number(session.durationMinutes) ?? 0),
      blockId: blockId(session.blockId),
      status: choice(session.status, SESSION_STATUSES, 'Planned'),
      notes: string(session.notes) || undefined,
    })),
    assignments: array(raw.assignments).map(record).filter((assignment) => string(assignment.id) && string(assignment.nodeId) && string(assignment.title)).map((assignment) => ({
      id: string(assignment.id),
      nodeId: string(assignment.nodeId),
      title: string(assignment.title),
      type: choice(assignment.type, ASSIGNMENT_TYPES, 'Assignment'),
      status: choice(assignment.status, ASSIGNMENT_STATUSES, 'Not Started'),
      dueDate: string(assignment.dueDate) || undefined,
      submittedAt: string(assignment.submittedAt) || undefined,
      score: number(assignment.score),
      maxScore: number(assignment.maxScore),
      feedback: string(assignment.feedback) || undefined,
    })),
  };
}

export const newEducationId = (prefix: 'learning' | 'session' | 'assignment'): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function descendantsOf(nodes: LearningNode[], parentId: string): LearningNode[] {
  const children = nodes.filter((node) => node.parentId === parentId);
  return children.flatMap((child) => [child, ...descendantsOf(nodes, child.id)]);
}

export function removeLearningNode(data: EducationData, id: string): EducationData {
  const ids = new Set([id, ...descendantsOf(data.nodes, id).map((node) => node.id)]);
  return {
    ...data,
    nodes: data.nodes.filter((node) => !ids.has(node.id)),
    sessions: data.sessions.filter((session) => !ids.has(session.nodeId)),
    assignments: data.assignments.filter((assignment) => !ids.has(assignment.nodeId)),
  };
}

export function nodeProgress(data: EducationData, id: string): number {
  const descendants = descendantsOf(data.nodes, id);
  if (descendants.length === 0) return data.nodes.find((node) => node.id === id)?.status === 'Completed' ? 100 : 0;
  return Math.round((descendants.filter((node) => node.status === 'Completed').length / descendants.length) * 100);
}

export function studyMinutesBetween(data: EducationData, start: string, end: string): number {
  return data.sessions.filter((session) => session.status === 'Done' && session.date >= start && session.date <= end).reduce((sum, session) => sum + session.durationMinutes, 0);
}

export function upcomingAssignments(data: EducationData, today: string, limit = 6): EducationAssignment[] {
  return data.assignments
    .filter((assignment) => assignment.dueDate && assignment.dueDate >= today && assignment.status !== 'Graded')
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .slice(0, limit);
}

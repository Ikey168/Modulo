import type { CoreNote } from '@modulo/core';
import { newLifeId, type LifeRecord } from './lifeStore';
import { dayKey } from './noteDates';

export function newLearningRecord(status: string, category: string): LifeRecord {
  return { id: newLifeId('record'), title: '', status, category, recurrence: 'Once', favorite: false, tags: [], values: {}, checklist: [], log: [] };
}

export function decisionIsDue(record: LifeRecord, today = dayKey(new Date())): boolean {
  return record.status === 'Pending review' && Boolean(record.date && record.date <= today);
}

export function validateDecision(record: LifeRecord): void {
  if (!record.title.trim() || !record.values.choice?.trim() || !record.values.expectedOutcome?.trim()) {
    throw new Error('Enter a title, chosen option, and expected outcome.');
  }
  const confidence = Number(record.values.confidence);
  if (record.values.confidence?.trim() && (!Number.isFinite(confidence) || confidence < 0 || confidence > 100)) {
    throw new Error('Confidence must be between 0 and 100.');
  }
}

export function reviewDecision(record: LifeRecord, outcome: string, lessons: string, today = dayKey(new Date())): LifeRecord {
  if (!outcome.trim()) throw new Error('Describe the actual outcome before completing the review.');
  return {
    ...record, status: 'Reviewed',
    values: { ...record.values, actualOutcome: outcome.trim(), lessons: lessons.trim(), reviewedOn: today },
    log: [{ id: newLifeId('log'), date: today, title: `Outcome: ${outcome.trim()}${lessons.trim() ? `\nLessons: ${lessons.trim()}` : ''}` }, ...record.log],
  };
}

export function skillPrerequisites(skill: LifeRecord): string[] {
  try {
    const ids: unknown = JSON.parse(skill.values.prerequisites || '[]');
    return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string'))] : [];
  } catch { return []; }
}

export function skillBlockers(skill: LifeRecord, skills: LifeRecord[]): string[] {
  return skillPrerequisites(skill).filter((id) => skills.find((item) => item.id === id)?.status !== 'Mastered');
}

export function validateSkill(skill: LifeRecord, skills: LifeRecord[]): void {
  if (!skill.title.trim()) throw new Error('Enter a skill name.');
  const records = new Map([...skills, skill].map((item) => [item.id, item]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error('Prerequisites cannot form a cycle.');
    if (visited.has(id)) return;
    const current = records.get(id);
    if (!current) throw new Error('A prerequisite is missing. Remove its link before saving.');
    visiting.add(id);
    skillPrerequisites(current).forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  visit(skill.id);
  if (skill.status === 'Mastered') {
    if (!skill.values.evidence?.trim()) throw new Error('Record evidence of mastery first.');
    if (skillBlockers(skill, [...records.values()]).length) throw new Error('Master the prerequisite skills first.');
  }
}

export function logSkillPractice(skill: LifeRecord, activity: string, minutes: number, today = dayKey(new Date())): LifeRecord {
  if (!activity.trim()) throw new Error('Describe what you practiced.');
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440 || !Number.isInteger(minutes)) {
    throw new Error('Practice duration must be a whole number from 1 to 1440 minutes.');
  }
  return {
    ...skill, status: skill.status === 'Planned' ? 'Practicing' : skill.status,
    values: { ...skill.values, practiceMinutes: String((Number(skill.values.practiceMinutes) || 0) + minutes) },
    log: [{ id: newLifeId('log'), date: today, title: `${minutes} min · ${activity.trim()}` }, ...skill.log],
  };
}

export function flashcardFromNote(note: CoreNote, question: string, passage: string, deck: string, skillId = ''): LifeRecord {
  if (!question.trim() || !passage.trim()) throw new Error('Enter a question and select or write an answer.');
  return {
    ...newLearningRecord('New', 'Concept'), title: question.trim(), date: dayKey(new Date()),
    values: {
      front: question.trim(), back: passage.trim(), deck: deck.trim() || 'Notes', skillId,
      source: `note:${note.id}`, sourceNoteId: String(note.id), sourceNoteTitle: note.title,
      intervalDays: '0', reps: '0', lapses: '0',
    },
  };
}

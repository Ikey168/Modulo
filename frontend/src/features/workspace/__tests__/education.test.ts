import { beforeEach, describe, expect, it } from 'vitest';
import {
  descendantsOf,
  emptyEducation,
  nodeProgress,
  parseEducation,
  removeLearningNode,
  studyMinutesBetween,
  upcomingAssignments,
  type EducationData,
} from '../education';

beforeEach(() => localStorage.clear());

const data = (): EducationData => ({
  version: 1,
  nodes: [
    { id: 'program', type: 'Program', title: 'Computer Science', status: 'Active' },
    { id: 'course', parentId: 'program', type: 'Course', title: 'Algorithms', status: 'Active' },
    { id: 'module', parentId: 'course', type: 'Module', title: 'Graphs', status: 'Completed' },
    { id: 'lesson', parentId: 'module', type: 'Lesson', title: 'Shortest paths', status: 'Completed' },
  ],
  sessions: [
    { id: 's1', nodeId: 'course', date: '2026-09-03', durationMinutes: 60, status: 'Done', blockId: 'deep-work-b' },
    { id: 's2', nodeId: 'lesson', date: '2026-09-04', durationMinutes: 45, status: 'Planned' },
  ],
  assignments: [
    { id: 'a1', nodeId: 'course', title: 'Problem set', type: 'Exercise', status: 'In Progress', dueDate: '2026-09-05' },
    { id: 'a2', nodeId: 'lesson', title: 'Quiz', type: 'Exam', status: 'Graded', dueDate: '2026-09-04' },
  ],
});

describe('education store', () => {
  it('parses records with safe defaults and rejects invalid day blocks', () => {
    const parsed = parseEducation({
      nodes: [{ id: 'n1', title: 'Course', type: 'Unknown', status: 'Unknown' }],
      sessions: [{ id: 's1', nodeId: 'n1', date: '2026-09-03', durationMinutes: -2, blockId: 'invalid', status: 'Unknown' }],
      assignments: [{ id: 'a1', nodeId: 'n1', title: 'Work', type: 'Unknown', status: 'Unknown' }],
    });
    expect(parsed.nodes[0]).toMatchObject({ type: 'Course', status: 'Planned' });
    expect(parsed.sessions[0]).toMatchObject({ durationMinutes: 0, blockId: undefined, status: 'Planned' });
    expect(parsed.assignments[0]).toMatchObject({ type: 'Assignment', status: 'Not Started' });
  });

  it('builds the hierarchy and calculates descendant progress', () => {
    const sample = data();
    expect(descendantsOf(sample.nodes, 'program').map((node) => node.id)).toEqual(['course', 'module', 'lesson']);
    expect(nodeProgress(sample, 'program')).toBe(67);
    expect(nodeProgress(sample, 'lesson')).toBe(100);
  });

  it('cascades curriculum deletion into sessions and assignments', () => {
    const next = removeLearningNode(data(), 'course');
    expect(next.nodes.map((node) => node.id)).toEqual(['program']);
    expect(next.sessions).toEqual([]);
    expect(next.assignments).toEqual([]);
  });

  it('summarizes completed study time and upcoming assignments', () => {
    const sample = data();
    expect(studyMinutesBetween(sample, '2026-09-01', '2026-09-07')).toBe(60);
    expect(upcomingAssignments(sample, '2026-09-03').map((assignment) => assignment.id)).toEqual(['a1']);
  });

  it('round-trips through server JSON and recovers from corrupt records', () => {
    const sample = data();
    expect(parseEducation(JSON.parse(JSON.stringify(sample)))).toEqual(sample);
    expect(parseEducation('{broken')).toEqual(emptyEducation());
    expect(parseEducation(null)).toEqual(emptyEducation());
  });
});

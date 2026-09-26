import { beforeEach, describe, expect, it } from 'vitest';
import {
  activeDeepResearchCount,
  artifactTemplate,
  canActivateItem,
  defaultArtifactType,
  emptyInformationIntake,
  minutesBetween,
  parseInformationIntake,
  removeIntakeItem,
  routeInformationMode,
  sessionsOn,
  staleArtifacts,
  suggestedNextMode,
  transitionResearch,
  projectProvenance,
  type InformationIntakeData,
  type IntakeItem,
} from '../informationIntake';

beforeEach(() => localStorage.clear());

const item = (update: Partial<IntakeItem> = {}): IntakeItem => ({ id: 'i1', title: 'Investigate passkeys', status: 'Inbox', tags: [], capturedAt: '2026-09-01T00:00:00.000Z', lastTouchedAt: '2026-09-01T00:00:00.000Z', ...update });

describe('Information Intake Modes store', () => {
  it('routes using the documented priority order', () => {
    expect(routeInformationMode({ urgentOrBroken: true, decisionNeeded: true })).toBe('Problem-Solving');
    expect(routeInformationMode({ curiosityOnly: true, systematicUnderstanding: true })).toBe('Exploration');
    expect(routeInformationMode({ decisionNeeded: true })).toBe('Decision Support');
    expect(routeInformationMode({ systematicUnderstanding: true })).toBe('Deep Research');
    expect(routeInformationMode({ creating: true })).toBe('Creation');
    expect(routeInformationMode({ externalize: true })).toBe('Externalization');
    expect(routeInformationMode({ internalize: true })).toBe('Internalization');
    expect(routeInformationMode({ iterating: true })).toBe('Iteration');
    expect(routeInformationMode({ maintenance: true })).toBe('Maintenance');
    expect(routeInformationMode({})).toBe('Awareness');
  });

  it('enforces the three-active-topic Deep Research limit', () => {
    const data = emptyInformationIntake();
    data.items = [1, 2, 3].map((index) => item({ id: `deep-${index}`, mode: 'Deep Research', status: 'Active' }));
    expect(activeDeepResearchCount(data)).toBe(3);
    expect(canActivateItem(data, item({ id: 'fourth', mode: 'Deep Research', status: 'Planned' }))).toBe(false);
    expect(canActivateItem(data, item({ id: 'decision', mode: 'Decision Support', status: 'Planned' }))).toBe(true);
  });

  it('provides the correct durable output and structured template per mode', () => {
    expect(defaultArtifactType('Problem-Solving')).toBe('Solution Note');
    expect(defaultArtifactType('Internalization')).toBe('Retrieval Pack');
    expect(artifactTemplate('Research Bundle')).toContain('## Claim ledger');
    expect(artifactTemplate('Decision Record')).toContain('## Revisit triggers');
  });

  it('parses safe defaults and rejects invalid modes and day blocks', () => {
    const parsed = parseInformationIntake({ items: [{ id: 'i1', title: 'Signal', mode: 'Wrong', status: 'Wrong', blockId: 'Wrong' }], sessions: [{ id: 's1', date: '2026-09-04', mode: 'Wrong', status: 'Wrong', durationMinutes: -4 }], artifacts: [{ id: 'a1', title: 'Output', type: 'Wrong', status: 'Wrong' }] });
    expect(parsed.items[0]).toMatchObject({ status: 'Inbox', mode: undefined, blockId: undefined });
    expect(parsed.sessions[0]).toMatchObject({ mode: 'Awareness', status: 'Planned', durationMinutes: 0 });
    expect(parsed.artifacts[0]).toMatchObject({ mode: 'Deep Research', type: 'Research Bundle', status: 'Draft' });
    expect(parsed.projects).toEqual([]);
    expect(parsed.transitions).toEqual([]);
  });

  it('records explicit transitions and preserves project provenance', () => {
    const data = emptyInformationIntake();
    data.projects.push({ id: 'p1', title: 'Passkeys', question: 'Are they ready?', status: 'Active', currentMode: 'Exploration', noteIds: [42], sourceIds: ['source-1'], createdAt: '2026-09-01', updatedAt: '2026-09-01' });
    data.items.push(item({ projectId: 'p1', mode: 'Exploration' }));
    data.sessions.push({ id: 's1', itemId: 'i1', mode: 'Exploration', date: '2026-09-04', durationMinutes: 60, status: 'Done' });
    data.artifacts.push({ id: 'a1', itemId: 'i1', mode: 'Exploration', type: 'Exploration Note', title: 'Trail', status: 'Stable', sourceUrls: ['https://example.com'], createdAt: '2026-09-04', updatedAt: '2026-09-04' });
    const moved = transitionResearch(data, { projectId: 'p1' }, 'Deep Research', 'Scope is stable', 'a1', '2026-09-04T12:00:00.000Z');
    expect(moved.projects[0]).toMatchObject({ currentMode: 'Deep Research', nextMode: 'Creation' });
    expect(moved.transitions[0]).toMatchObject({ projectId: 'p1', fromMode: 'Exploration', toMode: 'Deep Research', artifactId: 'a1' });
    expect(projectProvenance(moved, 'p1')).toEqual({ items: 1, sessions: 1, artifacts: 1, sources: 2, transitions: 1 });
    expect(suggestedNextMode('Internalization')).toBe('Iteration');
    expect(suggestedNextMode('Maintenance')).toBeUndefined();
  });

  it('summarizes scheduled work, time spent, and stale outputs', () => {
    const data = emptyInformationIntake();
    data.sessions.push(
      { id: 's2', mode: 'Awareness', date: '2026-09-05', durationMinutes: 20, blockId: 'reset', status: 'Planned' },
      { id: 's1', mode: 'Awareness', date: '2026-09-04', durationMinutes: 15, blockId: 'morning-prime', status: 'Done' },
    );
    data.artifacts.push({ id: 'a1', mode: 'Externalization', type: 'Playbook', title: 'Deploy', status: 'Stable', reviewDate: '2026-09-04', sourceUrls: [], createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    expect(sessionsOn(data, '2026-09-04').map((session) => session.id)).toEqual(['s1']);
    expect(minutesBetween(data, 'Awareness', '2026-09-01', '2026-09-07')).toBe(15);
    expect(staleArtifacts(data, '2026-09-04').map((artifact) => artifact.id)).toEqual(['a1']);
  });

  it('cascades session deletion, detaches durable outputs, and persists safely', () => {
    const data: InformationIntakeData = { ...emptyInformationIntake(), items: [item()], sessions: [{ id: 's1', itemId: 'i1', mode: 'Exploration', date: '2026-09-04', durationMinutes: 60, status: 'Done' }], artifacts: [{ id: 'a1', itemId: 'i1', mode: 'Exploration', type: 'Exploration Note', title: 'Discovery', status: 'Stable', sourceUrls: [], createdAt: '2026-09-04', updatedAt: '2026-09-04' }] };
    const removed = removeIntakeItem(data, 'i1');
    expect(removed.sessions).toEqual([]);
    expect(removed.artifacts[0].itemId).toBeUndefined();
    expect(parseInformationIntake(JSON.parse(JSON.stringify(data)))).toEqual(data);
    expect(parseInformationIntake('{broken')).toEqual(emptyInformationIntake());
  });
});

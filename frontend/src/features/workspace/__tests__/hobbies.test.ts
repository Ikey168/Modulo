import { describe, expect, it } from 'vitest';
import { DOCUMENTED_HOBBY_STACK, emptyHobbyData, hobbySessionsOn, mergeDocumentedHobbyStack, parseHobbyData, peopleYouCanText, restorativeRatio, trialProgress } from '../hobbies';

describe('hobby store', () => {
  it('loads the documented active and queued stack without duplicating it', () => {
    const first = mergeDocumentedHobbyStack(emptyHobbyData());
    const second = mergeDocumentedHobbyStack(first);
    expect(first.hobbies).toHaveLength(DOCUMENTED_HOBBY_STACK.length);
    expect(second.hobbies).toHaveLength(first.hobbies.length);
    expect(first.hobbies.some((item) => item.title === 'Tech — Homelab, Code & Infra' && item.status === 'Active')).toBe(true);
    expect(first.hobbies.some((item) => item.title === 'Makerspace + Modular Synths' && item.status === 'Queued')).toBe(true);
    expect(first.funMenu).toHaveLength(3);
  });

  it('measures six-session progress and sorts sessions by day block', () => {
    const data = mergeDocumentedHobbyStack(emptyHobbyData());
    const hobbyId = data.hobbies[0].id;
    data.sessions = [
      { id: 'later', hobbyId, date: '2026-09-04', durationMinutes: 60, blockId: 'early-evening', status: 'Done', people: [], notes: '' },
      { id: 'earlier', hobbyId, date: '2026-09-04', durationMinutes: 60, blockId: 'deep-work-a', status: 'Done', people: ['Ada'], notes: '' },
      ...Array.from({ length: 4 }, (_, index) => ({ id: `extra-${index}`, hobbyId, date: `2026-08-${index + 10}`, durationMinutes: 45, status: 'Done' as const, people: ['Ada', 'Lin'], notes: '' })),
    ];
    expect(trialProgress(data, hobbyId)).toBe(100);
    expect(hobbySessionsOn(data, '2026-09-04').map((item) => item.id)).toEqual(['earlier', 'later']);
    expect(peopleYouCanText(data)).toEqual(['Ada', 'Lin']);
  });

  it('tracks restorative play across hobby and fun sessions', () => {
    const data = mergeDocumentedHobbyStack(emptyHobbyData());
    const restorativeHobby = data.hobbies.find((item) => item.energyEffect === 'Restorative')!;
    const demandingHobby = data.hobbies.find((item) => item.energyEffect === 'Demanding')!;
    data.sessions = [
      { id: 'one', hobbyId: restorativeHobby.id, date: '2026-09-04', durationMinutes: 60, status: 'Done', people: [], notes: '' },
      { id: 'two', hobbyId: demandingHobby.id, date: '2026-09-04', durationMinutes: 60, status: 'Done', people: [], notes: '' },
    ];
    expect(restorativeRatio(data, data.sessions)).toBe(.5);
  });

  it('sanitizes malformed persisted values', () => {
    const parsed = parseHobbyData({ hobbies: [{ id: 'h1', title: 'Test', status: 'wat', energy: 'huge' }], sessions: [{ id: 's1', date: '2026-09-04', durationMinutes: -2, enjoyment: 99 }], artifacts: [], funMenu: [] });
    expect(parsed.hobbies[0]).toMatchObject({ status: 'Queued', energy: 'Medium' });
    expect(parsed.sessions[0]).toMatchObject({ durationMinutes: 0, enjoyment: 5 });
  });
});

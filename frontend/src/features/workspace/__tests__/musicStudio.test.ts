import { describe, expect, it } from 'vitest';
import { completedMusicMinutes, emptyMusicData, musicPracticeOn, parseMusicData, unfinishedMusicProjects } from '../musicStudio';

describe('music studio store', () => {
  it('parses safe defaults and keeps independent collections', () => {
    const data = parseMusicData({ projects: [{ id: 'p', title: 'Track', type: 'wat', status: 'wat' }], practice: [{ id: 's', date: '2026-09-04', minutes: -4, status: 'wat' }], assets: [{ id: 'a', title: 'Kick', type: 'wat' }] });
    expect(data.projects[0]).toMatchObject({ type: 'Track', status: 'Idea' });
    expect(data.practice[0]).toMatchObject({ minutes: 0, status: 'Planned' });
    expect(data.assets[0].type).toBe('Sample');
  });

  it('sorts day-block practice and totals completed time', () => {
    const data = emptyMusicData();
    data.practice.push(
      { id: 'late', date: '2026-09-04', instrument: 'Piano', focus: 'Harmony', piece: '', minutes: 30, blockId: 'wind-down', status: 'Done', notes: '' },
      { id: 'early', date: '2026-09-04', instrument: 'Guitar', focus: 'Technique', piece: '', minutes: 45, blockId: 'morning-prime', status: 'Done', notes: '' },
    );
    expect(musicPracticeOn(data, '2026-09-04').map((item) => item.id)).toEqual(['early', 'late']);
    expect(completedMusicMinutes(data, '2026-09-01', '2026-09-07')).toBe(75);
  });

  it('excludes released and archived projects from active work', () => {
    const data = emptyMusicData();
    data.projects.push(
      { id: 'a', title: 'Sketch', type: 'Track', status: 'Sketch', nextAction: 'Arrange', definitionOfDone: '', releaseNotes: '', collaborators: [] },
      { id: 'b', title: 'Single', type: 'Track', status: 'Released', nextAction: '', definitionOfDone: '', releaseNotes: '', collaborators: [] },
    );
    expect(unfinishedMusicProjects(data).map((item) => item.id)).toEqual(['a']);
  });
});

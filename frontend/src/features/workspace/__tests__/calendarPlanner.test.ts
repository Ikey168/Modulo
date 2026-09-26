import { describe, expect, it } from 'vitest';
import { calendarBlockOverview, blockOverviewCount } from '../calendarPlanner';
import { createEmptyPara } from '../para';
import { emptyMealPlanner } from '../mealPlanner';
import { emptyWorkoutPlanner } from '../workoutPlanner';
import { emptyEducation } from '../education';
import { emptyRoutines, setHabitCount, setRoutineDone } from '../routines';
import { HOME_MAINTENANCE_CONFIG } from '../lifeConfigs';
import { emptyLifeCollection } from '../lifeStore';
import { emptyHobbyData } from '../hobbies';
import { emptyMusicData } from '../musicStudio';
import { emptyElectronicsData } from '../electronicsWorkbench';
import { emptyHomelabData } from '../homelab';
import { emptyWardrobeData } from '../wardrobe';
import { emptyTtrpgData } from '../ttrpg';
import { emptyBusinessAdmin } from '../businessAdmin';

describe('calendar day block overview', () => {
  it('aggregates each specialist store without changing source ownership', () => {
    const para = createEmptyPara();
    para.tasks.push({ id: 'task', title: 'Write draft', status: 'Next', priority: 'P1', energy: 'High', doDate: '2026-09-03', blockId: 'deep-work-a' });
    const meals = emptyMealPlanner();
    meals.meals.push({ id: 'meal', date: '2026-09-03', title: 'Pasta', type: 'Dinner', servings: 2, blockId: 'early-evening', done: false });
    meals.prepSessions.push({ id: 'prep', title: 'Batch cook pasta', date: '2026-09-03', blockId: 'reset', portions: 4, portionsRemaining: 3, location: 'Fridge', mealIds: ['meal'], done: false });
    const workouts = emptyWorkoutPlanner();
    workouts.workouts.push({ id: 'workout', date: '2026-09-03', title: 'Lower A', type: 'Strength', durationMinutes: 60, blockId: 'morning-prime', done: true, exercises: [] });
    const education = emptyEducation();
    education.nodes.push({ id: 'course', type: 'Course', title: 'Algorithms', status: 'Active' });
    education.sessions.push({ id: 'study', nodeId: 'course', date: '2026-09-03', durationMinutes: 45, blockId: 'deep-work-b', status: 'Planned' });
    const body = '## Day blocks\n\n### Block 5 — Reset (13:45–14:30)\n- [ ] Take a walk\n\n## Notes';
    let routines = emptyRoutines();
    routines.routines.push({ id: 'routine', title: 'Morning reset', blockId: 'morning-prime', recurrence: { mode: 'Daily', daysOfWeek: [] }, active: true });
    routines.habits.push({ id: 'habit', title: 'Drink water', blockId: 'reset', recurrence: { mode: 'Daily', daysOfWeek: [] }, target: 2, unit: 'glasses', active: true });
    routines = setRoutineDone(routines, 'routine', '2026-09-03', true);
    routines = setHabitCount(routines, 'habit', '2026-09-03', 1);
    const home = emptyLifeCollection();
    home.records.push({ id: 'home', title: 'Service boiler', status: 'Done', category: 'Maintenance', date: '2026-09-03', recurrence: 'Yearly', blockId: 'ops-people', favorite: false, tags: [], values: {}, checklist: [], log: [] });
    const hobbies = emptyHobbyData();
    hobbies.hobbies.push({ id: 'music', layer: 'Output', title: 'Music Production', purpose: 'Expression', status: 'Active', anchor: 'Artifact', energy: 'High', energyEffect: 'Demanding', socialMode: 'Solo', artifactTarget: 'Track', cadence: 'Weekly', setup: 'REAPER ready', location: 'Studio', nextAction: 'Arrange the chorus' });
    hobbies.sessions.push({ id: 'music-session', hobbyId: 'music', date: '2026-09-03', durationMinutes: 90, blockId: 'early-evening', status: 'Planned', people: [], notes: '' });
    const music = emptyMusicData();
    music.practice.push({ id: 'practice', date: '2026-09-03', instrument: 'Guitar', focus: 'Chord changes', piece: 'Blue Bossa', minutes: 30, blockId: 'wind-down', status: 'Planned', notes: '' });
    const electronics = emptyElectronicsData();
    electronics.projects.push({ id: 'synth', title: 'Passive multiple', type: 'Module', status: 'Prototype', revision: 'A', nextAction: 'Test continuity', definitionOfDone: 'Passes signal' });
    electronics.lab.push({ id: 'bench', projectId: 'synth', type: 'Test', title: 'Continuity test', date: '2026-09-03', status: 'Planned', minutes: 30, blockId: 'ops-people', expected: 'All outputs connected', observed: '', notes: '' });
    const homelab = emptyHomelabData(); homelab.runs.push({ id: 'backup', type: 'Backup', title: 'Back up Paperless', date: '2026-09-03', minutes: 20, blockId: 'ops-people', status: 'Planned', outcome: '', nextAction: '' });
    const wardrobe = emptyWardrobeData(); wardrobe.logs.push({ id: 'style', type: 'Experiment', title: 'Try wide silhouette', date: '2026-09-03', blockId: 'early-evening', done: false, notes: '' });
    const ttrpg = emptyTtrpgData(); ttrpg.campaigns.push({ id: 'campaign', title: 'Night City', system: 'Cyberpunk RED', status: 'Active', cadence: 'Weekly', location: 'Berlin', gm: 'V', players: [], tone: '', safetyTools: 'X-card', notes: '' }); ttrpg.sessions.push({ id: 'game', campaignId: 'campaign', title: 'The Heist', date: '2026-09-03', minutes: 240, blockId: 'early-evening', status: 'Planned', attendees: [], prep: '', summary: '', decisions: '', nextHook: '' });
    const business = emptyBusinessAdmin(); business.obligations.push({ id: 'vat', type: 'Tax filing', title: 'File USt-VA', authority: 'Finanzamt', dueDate: '2026-09-03', blockId: 'ops-people', status: 'Open', reference: '', notes: '' }); business.correspondence.push({ id: 'reply', direction: 'Inbound', counterpartyType: 'Authority', subject: 'Reply to letter', date: '2026-09-01', dueDate: '2026-09-03', blockId: 'ops-people', status: 'Open', notes: '' });

    const overview = calendarBlockOverview('2026-09-03', body, para, meals, workouts, education, routines, [{ config: HOME_MAINTENANCE_CONFIG, data: home }], hobbies, music, electronics, homelab, wardrobe, ttrpg, business);

    expect(overview['deep-work-a'][0]).toMatchObject({ title: 'Write draft', source: 'Task' });
    expect(overview['early-evening'][0]).toMatchObject({ title: 'Pasta', source: 'Meal' });
    expect(overview.reset.some((item) => item.source === 'Meal prep' && item.title === 'Batch cook pasta')).toBe(true);
    expect(overview['morning-prime'][0]).toMatchObject({ title: 'Lower A', source: 'Workout', done: true });
    expect(overview['deep-work-b'][0]).toMatchObject({ title: 'Algorithms', source: 'Study' });
    expect(overview.reset[0]).toMatchObject({ title: 'Take a walk', source: 'Plan' });
    expect(overview['morning-prime'].some((item) => item.source === 'Routine' && item.done)).toBe(true);
    expect(overview.reset.some((item) => item.source === 'Habit' && !item.done)).toBe(true);
    expect(overview['ops-people'].some((item) => item.title === 'Service boiler' && item.source === 'Home' && item.done)).toBe(true);
    expect(overview['early-evening'].some((item) => item.source === 'Hobby' && item.title === 'Music Production')).toBe(true);
    expect(overview['wind-down'].some((item) => item.source === 'Music' && item.title.includes('Guitar'))).toBe(true);
    expect(overview['ops-people'].some((item) => item.source === 'Electronics' && item.title === 'Continuity test')).toBe(true);
    expect(overview['ops-people'].some((item) => item.source === 'Homelab')).toBe(true);
    expect(overview['early-evening'].some((item) => item.source === 'Style')).toBe(true);
    expect(overview['early-evening'].some((item) => item.source === 'TTRPG')).toBe(true);
    expect(overview['ops-people'].filter((item) => item.source === 'Business')).toHaveLength(2);
    expect(blockOverviewCount(overview)).toBe(17);
  });

  it('only includes records assigned to the selected date and a block', () => {
    const para = createEmptyPara();
    para.tasks.push(
      { id: 'wrong-day', title: 'Tomorrow', status: 'Next', priority: 'P3', energy: 'Medium', doDate: '2026-09-04', blockId: 'deep-work-a' },
      { id: 'unblocked', title: 'Unblocked', status: 'Next', priority: 'P3', energy: 'Medium', doDate: '2026-09-03' },
    );
    const overview = calendarBlockOverview('2026-09-03', '', para, emptyMealPlanner(), emptyWorkoutPlanner(), emptyEducation());
    expect(blockOverviewCount(overview)).toBe(0);
  });
});

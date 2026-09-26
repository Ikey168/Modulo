import { describe, expect, it } from 'vitest';
import { emptyHomelabData, homelabRunsOn, parseHomelabData } from '../homelab';
import { emptyWardrobeData, parseWardrobeData, styleLogsOn } from '../wardrobe';
import { emptyTtrpgData, gameSessionsOn, parseTtrpgData } from '../ttrpg';

describe('hobby specialist stores', () => {
  it('sanitizes homelab data and selects scheduled operations', () => { const parsed = parseHomelabData({ assets: [{ id: 'a', name: 'Pi', type: 'wat', status: 'wat' }], runs: [] }); expect(parsed.assets[0]).toMatchObject({ type: 'Other', status: 'Planned' }); const data = emptyHomelabData(); data.runs.push({ id: 'r', type: 'Backup', title: 'Backup', date: '2026-09-04', minutes: 30, status: 'Done', outcome: '', nextAction: '' }); expect(homelabRunsOn(data, '2026-09-04')).toHaveLength(1); });
  it('sanitizes wardrobe data and selects scheduled style work', () => { const parsed = parseWardrobeData({ garments: [{ id: 'g', name: 'Coat', category: 'wat', status: 'wat' }], outfits: [], logs: [] }); expect(parsed.garments[0]).toMatchObject({ category: 'Other', status: 'Active' }); const data = emptyWardrobeData(); data.logs.push({ id: 'l', type: 'Experiment', title: 'Silhouette', date: '2026-09-04', done: false, notes: '' }); expect(styleLogsOn(data, '2026-09-04')).toHaveLength(1); });
  it('sanitizes TTRPG data and selects campaign sessions', () => { const parsed = parseTtrpgData({ campaigns: [{ id: 'c', title: 'Night City', status: 'wat' }], entities: [], sessions: [] }); expect(parsed.campaigns[0].status).toBe('Idea'); const data = emptyTtrpgData(); data.sessions.push({ id: 's', campaignId: 'c', title: 'Session zero', date: '2026-09-04', minutes: 180, status: 'Planned', attendees: [], prep: '', summary: '', decisions: '', nextHook: '' }); expect(gameSessionsOn(data, '2026-09-04')).toHaveLength(1); });
});

import { describe, expect, it } from 'vitest';
import { blockedBom, emptyElectronicsData, labEntriesOn, lowStockParts, parseElectronicsData } from '../electronicsWorkbench';

describe('electronics workbench store', () => {
  it('parses safe defaults and clamps inventory values', () => {
    const data = parseElectronicsData({ projects: [{ id: 'p', title: 'Mixer', type: 'wat', status: 'wat' }], parts: [{ id: 'r', name: '10k', category: 'wat', quantity: -2, reorderAt: -1 }], bom: [], lab: [] });
    expect(data.projects[0]).toMatchObject({ type: 'Circuit', status: 'Idea', revision: 'A' });
    expect(data.parts[0]).toMatchObject({ category: 'Other', quantity: 0, reorderAt: 0 });
  });

  it('finds procurement blockers and reorder thresholds', () => {
    const data = emptyElectronicsData();
    data.parts.push({ id: 'r', name: '10k', category: 'Resistor', quantity: 3, reorderAt: 5, location: 'A1', notes: '' });
    data.bom.push({ id: 'b', projectId: 'p', description: '10k resistor', quantity: 4, status: 'Need' });
    expect(lowStockParts(data).map((item) => item.id)).toEqual(['r']);
    expect(blockedBom(data).map((item) => item.id)).toEqual(['b']);
  });

  it('sorts scheduled bench work by shared day block', () => {
    const data = emptyElectronicsData();
    data.lab.push(
      { id: 'late', projectId: 'p', type: 'Test', title: 'Measure noise', date: '2026-09-04', status: 'Planned', minutes: 30, blockId: 'early-evening', expected: '', observed: '', notes: '' },
      { id: 'early', projectId: 'p', type: 'Assembly', title: 'Solder headers', date: '2026-09-04', status: 'Planned', minutes: 45, blockId: 'deep-work-a', expected: '', observed: '', notes: '' },
    );
    expect(labEntriesOn(data, '2026-09-04').map((item) => item.id)).toEqual(['early', 'late']);
  });
});

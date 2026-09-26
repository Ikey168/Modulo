import { expect, it } from 'vitest';
import { AREA_CHECKLIST_HEALTH, requirementsFor, withRequirements } from '../areaRequirements';
import { AREA_REQUIREMENT_DETAILS } from '../areaRequirementDetails';
import { parsePara } from '../para';

it('uses distinct criteria for each area and health level', () => {
  const areas = parsePara({ areas: [
    { id: 'sleep', name: 'Sleep & Recovery' },
    { id: 'tax', name: 'Taxes, Legal & Compliance' },
  ] }).areas;
  expect(requirementsFor(areas[0], 'Under Control')[0].text).toContain('Rest supports daytime functioning');
  expect(requirementsFor(areas[1], 'Under Control')[0].text).toContain('Filings and legal obligations');
  expect(requirementsFor(areas[0], 'Rebuilding')[0].text).toContain('adequate rest');
  expect(requirementsFor(areas[0], 'Growing')[0].text).toContain('sleep schedule');
});

it('keeps imported area criteria when an area is renamed', () => {
  const renamed = parsePara({ areas: [{
    id: 'area-notion-8ce46939d3d9490d90bf501daac4b3e8',
    name: 'My sleep',
  }] }).areas[0];
  expect(requirementsFor(renamed, 'Under Control')[0].text).toBe('Rest supports daytime functioning most weeks.');
});

it('expands the shared template without transferring checks to new standards', () => {
  const area = parsePara({ areas: [{
    id: 'sleep', name: 'Sleep & Recovery', requirements: {
      Rebuilding: [
        { id: 'rebuilding-0', text: 'The most urgent problem is identified and contained.', done: true },
        { id: 'rebuilding-1', text: 'A realistic first step to restore this area is scheduled.', done: false },
        { id: 'custom-1', text: 'Book a sleep consultation', done: true },
      ],
    },
  }] }).areas[0];
  const expanded = requirementsFor(area, 'Rebuilding');
  expect(expanded).toEqual(expect.arrayContaining([
    expect.objectContaining({ text: 'Protect the next opportunity for adequate rest.', done: false }),
    expect.objectContaining({ text: 'The most urgent problem is identified and contained.', done: true }),
    expect.objectContaining({ text: 'Book a sleep consultation', done: true }),
  ]));
  expect(expanded.filter((item) => item.id.includes('-detail-'))).toHaveLength(4);
  expect(expanded.filter((item) => item.id.includes('-detail-')).every((item) => !item.done)).toBe(true);
});

it('provides five distinct criteria for every status of every known area', () => {
  for (const name of Object.keys(AREA_REQUIREMENT_DETAILS)) {
    const area = parsePara({ areas: [{ id: name, name }] }).areas[0];
    for (const health of AREA_CHECKLIST_HEALTH) {
      const items = requirementsFor(area, health);
      expect(items, `${name}: ${health}`).toHaveLength(5);
      expect(new Set(items.map((item) => item.text)).size).toBe(5);
      expect(new Set(items.map((item) => item.id)).size).toBe(5);
    }
  }
});

it('preserves specific checks and custom items, and does not restore deleted details after reload', () => {
  const area = parsePara({ areas: [{
    id: 'sleep', name: 'Sleep & Recovery', requirements: {
      'Under Control': [
        { id: 'under-control-0', text: 'Rest supports daytime functioning most weeks.', done: true },
        { id: 'under-control-1', text: 'Sleep & Recovery has a regular review to catch new issues.', done: false },
        { id: 'custom-2', text: 'My personally chosen bedtime', done: true },
      ],
    },
  }] }).areas[0];
  const expanded = requirementsFor(area, 'Under Control');
  expect(expanded).toHaveLength(6);
  expect(expanded[0].done).toBe(true);
  expect(expanded[1]).toMatchObject({ id: 'custom-2', done: true });
  const removedId = expanded[2].id;
  const updated = withRequirements(area, 'Under Control', expanded.filter((item) => item.id !== removedId));
  const reloaded = parsePara(JSON.parse(JSON.stringify({ areas: [updated] }))).areas[0];
  expect(requirementsFor(reloaded, 'Under Control')).toEqual(updated.requirements?.['Under Control']);
  expect(requirementsFor(reloaded, 'Under Control').some((item) => item.id === removedId)).toBe(false);
  expect(requirementsFor(reloaded, 'Growing')).toHaveLength(5);
});

it('preserves a deliberately cleared checklist', () => {
  const area = parsePara({ areas: [{ id: 'sleep', name: 'Sleep & Recovery', requirements: { Messy: [] } }] }).areas[0];
  expect(requirementsFor(area, 'Messy')).toEqual([]);
});

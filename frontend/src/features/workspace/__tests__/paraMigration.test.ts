import { describe, expect, it } from 'vitest';
import { parseCsv, previewNotionFiles } from '../paraMigration';

const file = (name: string, contents: string): File => ({ name, webkitRelativePath: '', text: async () => contents } as File);

describe('Notion PARA migration', () => {
  it('parses quoted CSV values and escaped quotes', () => {
    expect(parseCsv('Name,Outcome\n"Project, One","Ship ""well"""\n')).toEqual([{ name: 'Project, One', outcome: 'Ship "well"' }]);
  });

  it('maps known databases and recovers relations by title', async () => {
    const preview = await previewNotionFiles([
      file('Areas.csv', 'Name,Status,Focus Level\nHealth,Messy,Core\n'),
      file('Projects.csv', 'Name,Status,Area,Priority\nTraining Block,Active,Health,High\n'),
      file('Tasks.csv', 'Name,Status,Project,Area,Do Date,Block\nLift,Next,Training Block,Health,2026-09-03,Block 3 — Deep Work A\n'),
    ]);
    expect(preview.data.areas[0]).toMatchObject({ name: 'Health', health: 'Messy', focus: 'Core' });
    expect(preview.data.projects[0].areaIds).toEqual([preview.data.areas[0].id]);
    expect(preview.data.tasks[0]).toMatchObject({ projectId: preview.data.projects[0].id, areaId: preview.data.areas[0].id, priority: 'P3', blockId: 'deep-work-a' });
  });

  it('turns Markdown pages into note resources with stable source ids', async () => {
    const preview = await previewNotionFiles([file('Atomic Habits abcdefabcdefabcdefabcdefabcdefab.md', '# Notes')]);
    expect(preview.markdown[0]).toMatchObject({ title: 'Atomic Habits', content: '# Notes' });
    expect(preview.data.resources[0].sourceId).toContain('Atomic Habits');
  });
});

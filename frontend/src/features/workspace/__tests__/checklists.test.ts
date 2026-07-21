import { describe, expect, it } from 'vitest';
import { CHECKLIST_TEMPLATES, parseChecklistProgress } from '../checklists';

describe('parseChecklistProgress', () => {
  it('counts checkboxes per section', () => {
    const body = `# Audit

## Access control
- [x] roles reviewed
- [ ] two-step transfer

## Arithmetic
- [X] overflow checked
- [x] rounding ok
- [ ] fuzzing done

Prose without boxes.
`;
    const p = parseChecklistProgress(body);
    expect(p.sections).toEqual([
      { title: 'Access control', done: 1, total: 2 },
      { title: 'Arithmetic', done: 2, total: 3 },
    ]);
    expect(p.done).toBe(3);
    expect(p.total).toBe(5);
  });

  it('groups pre-heading checkboxes under "Checklist" and supports * bullets', () => {
    const p = parseChecklistProgress('- [ ] one\n* [x] two');
    expect(p.sections).toEqual([{ title: 'Checklist', done: 1, total: 2 }]);
  });

  it('omits sections without checkboxes and handles empty bodies', () => {
    expect(parseChecklistProgress('## Nothing here\nprose only').sections).toEqual([]);
    expect(parseChecklistProgress('').total).toBe(0);
  });

  it('every shipped template parses with all items unchecked', () => {
    for (const t of CHECKLIST_TEMPLATES) {
      const p = parseChecklistProgress(t.markdown);
      expect(p.total).toBeGreaterThan(5);
      expect(p.done).toBe(0);
      expect(p.sections.length).toBeGreaterThanOrEqual(2);
    }
  });
});

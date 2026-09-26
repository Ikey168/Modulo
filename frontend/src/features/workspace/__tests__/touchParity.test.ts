import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import { treeMoveOptions, type TreeNode } from '../noteTree';

const SRC = join(__dirname, '../../..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return name.endsWith('.tsx') ? [path] : [];
  });
}

/** Every JSX class string in the tree, with its file. */
function classStrings(): { file: string; value: string }[] {
  return sources(SRC).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/className=(?:"([^"]*)"|\{?'([^']*)')/g)].map((match) => ({
      file: relative(SRC, file), value: match[1] ?? match[2],
    }));
  });
}

describe('touch parity (#491)', () => {
  it('reveals no interactive control only on hover', () => {
    const offenders = classStrings()
      .filter(({ value }) => /\bopacity-0\b/.test(value) && /group-hover[^ ]*:opacity-100/.test(value))
      // Decorative affordances (arrows beside a link) are aria-hidden icons, not controls.
      .filter(({ value }) => !/\bshrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100$/.test(value))
      .filter(({ value }) => !/coarse:(?:[a-z-]+:)?opacity-100|coarse:hidden/.test(value))
      .map(({ file, value }) => `${file}: ${value.slice(0, 80)}`);
    expect(offenders).toEqual([]);
  });

  it('offers the note tree drag moves as menu and keyboard actions', () => {
    const node = (id: number, title: string): TreeNode => ({ note: { id, title } as CoreNote, depth: 0, children: [] });
    const [a, b, c] = [node(1, 'A'), node(2, 'B'), node(3, 'C')];
    expect(treeMoveOptions([a, b, c], 0).map((o) => o.id)).toEqual(['down']);
    expect(treeMoveOptions([a, b, c], 1, a)).toEqual([
      { id: 'up', label: 'Move up', target: 1, pos: 'before' },
      { id: 'down', label: 'Move down', target: 3, pos: 'after' },
      { id: 'indent', label: 'Nest under A', target: 1, pos: 'inside' },
      { id: 'outdent', label: 'Move out one level', target: 1, pos: 'after' },
    ]);
  });
});

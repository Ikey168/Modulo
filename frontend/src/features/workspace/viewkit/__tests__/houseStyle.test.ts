import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the conventions the view kit exists to enforce.
 *
 * Every rule here is a defect that was found across the plugin screens and
 * fixed: each one had drifted independently into a dozen files because nothing
 * stopped it. These assertions are the thing that stops it.
 */

const VIEW_DIR = join(__dirname, '../..');
// Domain pack views live in src/packs/<pack>/ and follow the same house style.
const PACKS_DIR = join(__dirname, '../../../../packs');
const SRC_DIR = join(__dirname, '../../../..');

const isView = (name: string) => /View\.tsx$|Views\.tsx$/.test(name);
const views = [
  ...readdirSync(VIEW_DIR).filter(isView).map((name) => join(VIEW_DIR, name)),
  ...readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readdirSync(join(PACKS_DIR, entry.name)).filter(isView).map((name) => join(PACKS_DIR, entry.name, name))),
].map((path) => relative(SRC_DIR, path));

const read = (name: string) => readFileSync(join(SRC_DIR, name), 'utf8');

/** Comments discuss these patterns legitimately; only real code should fail. */
const code = (name: string) =>
  read(name)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Screens still awaiting migration. Shrink this list; never grow it.
 */
const EXEMPT = new Set<string>([]);

/**
 * Colour that encodes a category rather than a status is legitimate: the six
 * day-block tints cannot be expressed by four semantic tokens. Everything else
 * must use `success` / `warning` / `destructive` / `info`.
 */
const CATEGORICAL_PALETTE = new Set(['CalendarView.tsx', 'PlannerView.tsx']);

const candidates = views.filter((name) => !EXEMPT.has(name));

describe('workspace view house style', () => {
  it('finds the view files it is meant to guard', () => {
    expect(candidates.length).toBeGreaterThan(30);
  });

  it.each(candidates)('%s uses the Select primitive, not a raw <select>', (name) => {
    expect(code(name)).not.toMatch(/<select[\s>]/);
  });

  it.each(candidates)('%s does not re-declare the shared SELECT style constant', (name) => {
    expect(read(name)).not.toMatch(/const SELECT\s*=/);
  });

  it.each(candidates.filter((name) => !CATEGORICAL_PALETTE.has(basename(name))))(
    '%s uses semantic colour tokens, not the raw palette',
    (name) => {
      const hits = read(name).match(
        /\b(?:text|bg|border|fill|ring)-(?:emerald|amber|red|green|blue|orange|yellow)-\d{3}\b/g,
      );
      expect(hits ?? []).toEqual([]);
    },
  );

  // `text-xxs` is exactly 11px, so `text-[11px]` is always the token spelled out
  // by hand. 9px and 10px are left alone: the mini month grid genuinely needs them.
  it.each(candidates)('%s uses the text-xxs token rather than spelling out 11px', (name) => {
    const hits = read(name).match(/text-\[11px\]/g);
    expect(hits ?? []).toEqual([]);
  });

  it.each(candidates)('%s does not re-roll a scaffold the view kit provides', (name) => {
    const source = read(name);
    const locals = ['Shell', 'Metric', 'Panel', 'Empty', 'Field', 'Choice', 'Delete', 'Health', 'ChoicePairs'];
    const found = locals.filter((local) => new RegExp(`function ${local}\\s*\\(`).test(source));
    expect(found).toEqual([]);
  });
});

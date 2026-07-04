import { describe, expect, it } from 'vitest';
import { PACKS } from '../packs';
import { CATALOG } from '../catalog';
import { isRunnable } from '../types';
import { NOTES_PLUGIN_ID } from '../../plugins';
import { NOTES_NODES, createCoreCatalog } from '../../../blueprint/nodeCatalog';
import { validateIR } from '../../../blueprint/blueprintIR';

const manifest = (id: string) => CATALOG.find((m) => m.id === id);

describe('packs catalog', () => {
  it('bundles only installable plugins', () => {
    for (const pack of PACKS) {
      for (const id of pack.pluginIds) {
        const m = manifest(id);
        expect(m, `plugin '${id}' referenced by pack '${pack.id}'`).toBeTruthy();
        expect(isRunnable(m!), `plugin '${id}' must be installable`).toBe(true);
      }
    }
  });

  it('bundles blueprints that validate against the pack plugin nodes', () => {
    for (const pack of PACKS) {
      // The nodes available after installing the pack: core primitives, plus the
      // Notes plugin's nodes when the pack includes Markdown Notes.
      const catalog = createCoreCatalog();
      if (pack.pluginIds.includes(NOTES_PLUGIN_ID)) NOTES_NODES.forEach((n) => catalog.register(n));
      for (const b of pack.blueprints) {
        const check = validateIR(b.ir, catalog);
        expect(check.ok, `blueprint '${b.name}' in '${pack.id}': ${check.ok ? '' : check.reason}`).toBe(true);
      }
    }
  });

  it('has unique pack ids and blueprint names', () => {
    const ids = PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = PACKS.flatMap((p) => p.blueprints.map((b) => b.name));
    expect(new Set(names).size).toBe(names.length);
  });
});

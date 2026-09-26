import { beforeEach, describe, expect, it } from 'vitest';
import { PluginRuntime } from '../runtime';
import { CATALOG } from '../catalog';
import {
  AI_SUMMARY_PLUGIN_ID,
  AUTO_LINKER_PLUGIN_ID,
  FOCUS_PLUGIN_ID,
  GITHUB_SYNC_PLUGIN_ID,
  GRAPH_STATS_PLUGIN_ID,
  IPFS_ATTACH_PLUGIN_ID,
  LATEX_PLUGIN_ID,
  MERMAID_PLUGIN_ID,
  PDF_EXPORT_PLUGIN_ID,
  SEMANTIC_SEARCH_PLUGIN_ID,
  TIMESTAMP_PROOFS_PLUGIN_ID,
  WEB3_ID_PLUGIN_ID,
} from '../../plugins';

const ADVANCED_IDS = [
  LATEX_PLUGIN_ID,
  AI_SUMMARY_PLUGIN_ID,
  GITHUB_SYNC_PLUGIN_ID,
  MERMAID_PLUGIN_ID,
  PDF_EXPORT_PLUGIN_ID,
  GRAPH_STATS_PLUGIN_ID,
  WEB3_ID_PLUGIN_ID,
  FOCUS_PLUGIN_ID,
  IPFS_ATTACH_PLUGIN_ID,
  TIMESTAMP_PROOFS_PLUGIN_ID,
  SEMANTIC_SEARCH_PLUGIN_ID,
  AUTO_LINKER_PLUGIN_ID,
];

beforeEach(() => localStorage.clear());

describe('advanced marketplace plugins', () => {
  it('installs and activates every former coming-soon entry', async () => {
    const runtime = new PluginRuntime(CATALOG);
    await runtime.init();
    for (const id of ADVANCED_IDS) await runtime.install(id);

    expect(ADVANCED_IDS.every((id) => runtime.isActive(id))).toBe(true);
    expect(ADVANCED_IDS.map((id) => runtime.errorOf(id))).toEqual(ADVANCED_IDS.map(() => undefined));

    const contributions = runtime.contributions();
    expect(contributions.views.map((view) => view.id)).toEqual(expect.arrayContaining(['github-sync', 'semantic-search', 'graph-stats', 'web3-id', 'focus']));
    expect(contributions.notePanels.map((panel) => panel.id)).toEqual(expect.arrayContaining(['ai-summary', 'pdf-export', 'ipfs-attach', 'timestamp-proofs', 'auto-linker', 'knowledge-search']));
    expect(contributions.noteFences.map((fence) => fence.language)).toEqual(expect.arrayContaining(['math', 'latex', 'mermaid']));
  }, 30_000);
});

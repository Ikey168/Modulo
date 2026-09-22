import { beforeEach, describe, expect, it } from 'vitest';
import { DOMAIN_COLLECTION_CONFIGS, DOMAIN_DEFINITIONS } from '../domainConfigs';
import { containsProhibitedSecuritySecret, emptyLifeCollection, lifeStoreKey } from '../lifeStore';
import { collectLifeOsEntities, createLifeOsBackup, planLifeOsRestore } from '../lifeOs';
import { PACKS } from '../plugins/packs';
import { CATALOG } from '../plugins/catalog';
import type { PluginContext, ViewContribution } from '../plugins/types';

describe('specialist domain packs', () => {
  beforeEach(() => localStorage.clear());

  it('defines three independent collections for every new domain', () => {
    expect(DOMAIN_DEFINITIONS).toHaveLength(6);
    expect(DOMAIN_COLLECTION_CONFIGS).toHaveLength(18);
    expect(new Set(DOMAIN_COLLECTION_CONFIGS.map((config) => config.id)).size).toBe(18);
    for (const domain of DOMAIN_DEFINITIONS) {
      expect(domain.configIds).toHaveLength(3);
      expect(domain.configIds.every((id) => DOMAIN_COLLECTION_CONFIGS.some((config) => config.id === id))).toBe(true);
    }
  });

  it('registers each requested pack and extends mobility with Travel Planner', () => {
    for (const id of ['pack-digital-security-identity', 'pack-personal-finance-wealth', 'pack-research-evidence-lab', 'pack-career-studio', 'pack-writing-publishing-studio', 'pack-travel-mobility']) {
      expect(PACKS.find((pack) => pack.id === id), id).toBeTruthy();
    }
    expect(PACKS.find((pack) => pack.id === 'pack-travel-mobility')?.pluginIds).toContain('travel-planner');
  });

  it('marks every security collection metadata-only and exposes no secret fields', () => {
    const security = DOMAIN_COLLECTION_CONFIGS.filter((config) => config.id.startsWith('security-'));
    expect(security).toHaveLength(3);
    for (const config of security) {
      expect(config.securityMetadataOnly).toBe(true);
      expect(config.fields.map((field) => field.key)).not.toEqual(expect.arrayContaining(['password', 'passphrase', 'privateKey', 'seedPhrase', 'mnemonic']));
    }
  });

  it('rejects secret-looking data at the security-store boundary', () => {
    expect(containsProhibitedSecuritySecret({ notes: 'password: hunter2' })).toBe(true);
    expect(containsProhibitedSecuritySecret({ notes: '-----BEGIN PRIVATE KEY-----' })).toBe(true);
    expect(containsProhibitedSecuritySecret({ notes: 'External password manager: 1Password' })).toBe(false);
    const unsafe = { ...emptyLifeCollection(), records: [{ id: 'r1', title: 'Wallet', status: 'Active', category: 'Wallet', recurrence: 'Once' as const, favorite: false, tags: [], values: {}, checklist: [], log: [], notes: 'seed phrase: alpha beta gamma delta' }] };
    expect(containsProhibitedSecuritySecret(unsafe)).toBe(true);
    const backup = createLifeOsBackup([], [], [], { [lifeStoreKey('security-inventory')]: unsafe, [lifeStoreKey('wealth-balance-sheet')]: unsafe });
    const plan = planLifeOsRestore(backup, {});
    expect(plan.result.skipped).toContain(lifeStoreKey('security-inventory'));
    expect(plan.planned.map((item) => item.key)).toContain(lifeStoreKey('wealth-balance-sheet'));
  });

  it('makes the new independent stores visible to Life OS projections', () => {
    const data = emptyLifeCollection();
    data.records.push({ id: 'claim-1', title: 'A supported result', status: 'Supported', category: 'Claim', recurrence: 'Once', favorite: false, tags: ['research'], values: {}, checklist: [], log: [] });
    expect(collectLifeOsEntities([], { [lifeStoreKey('evidence-claims')]: data })).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'A supported result', route: 'evidence-claims', source: 'Claims & Evidence Map' }),
    ]));
  });

  it('lazy-loads every collection and dashboard into its own domain hub', async () => {
    for (const domain of DOMAIN_DEFINITIONS) {
      for (const id of [...domain.configIds, `${domain.id}-dashboard`]) {
        const manifest = CATALOG.find((candidate) => candidate.id === id);
        expect(manifest?.load, id).toBeTypeOf('function');
        const views: ViewContribution[] = [];
        const context: PluginContext = {
          state: async () => { throw new Error('State not used by this fixture'); },
          addView: (view) => { views.push(view); }, addNotePanel: () => undefined, addNoteFence: () => undefined,
          addEditorAction: () => undefined, addBlueprintNode: () => undefined,
        };
        const module = await manifest!.load!();
        const plugin = 'default' in module ? module.default : module;
        await plugin.activate(context);
        expect(views).toEqual([expect.objectContaining({ id, mode: domain.id })]);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { PACKS } from '../packs';
import { CATALOG } from '../catalog';
import { isRunnable, type PluginContext, type ViewContribution } from '../types';
import {
  AUDIT_CORE_BROWSER_PLUGIN_ID,
  AUDIT_CORE_FINDINGS_PLUGIN_ID,
  AUDIT_CORE_OVERVIEW_PLUGIN_ID,
  AUDIT_CORE_REMEDIATION_PLUGIN_ID,
  AUDIT_CORE_REPORT_PLUGIN_ID,
  AUDIT_CORE_SCOPE_PLUGIN_ID,
  AUDIT_CORE_TESTS_PLUGIN_ID,
  AUDIT_CORE_THREATS_PLUGIN_ID,
  BUSINESS_CONTRACTS_PLUGIN_ID,
  BUSINESS_DASHBOARD_PLUGIN_ID,
  BUSINESS_DIRECTORY_PLUGIN_ID,
  BUSINESS_OBLIGATIONS_PLUGIN_ID,
  BUSINESS_OPERATIONS_PLUGIN_ID,
  BUSINESS_RECONCILIATION_PLUGIN_ID,
  EDUCATION_ASSIGNMENTS_PLUGIN_ID,
  EDUCATION_CORE_PLUGIN_ID,
  EDUCATION_CURRICULUM_PLUGIN_ID,
  EDUCATION_DASHBOARD_PLUGIN_ID,
  EDUCATION_STUDY_PLUGIN_ID,
  INFORMATION_INTAKE_PLUGIN_ID,
  HOBBY_DASHBOARD_PLUGIN_ID,
  HOBBY_FUN_PLUGIN_ID,
  HOBBY_PRACTICE_PLUGIN_ID,
  HOBBY_STACK_PLUGIN_ID,
  MUSIC_DASHBOARD_PLUGIN_ID,
  MUSIC_LIBRARY_PLUGIN_ID,
  MUSIC_PRACTICE_PLUGIN_ID,
  MUSIC_PROJECTS_PLUGIN_ID,
  ELECTRONICS_DASHBOARD_PLUGIN_ID,
  ELECTRONICS_LAB_PLUGIN_ID,
  ELECTRONICS_PARTS_PLUGIN_ID,
  ELECTRONICS_PROJECTS_PLUGIN_ID,
  HOMELAB_ASSETS_PLUGIN_ID,
  HOMELAB_OPERATIONS_PLUGIN_ID,
  HOMELAB_DASHBOARD_PLUGIN_ID,
  HEALTH_TRACKER_PLUGIN_ID,
  WARDROBE_CLOSET_PLUGIN_ID,
  STYLE_STUDIO_PLUGIN_ID,
  WARDROBE_DASHBOARD_PLUGIN_ID,
  TTRPG_CAMPAIGNS_PLUGIN_ID,
  TTRPG_WORLD_PLUGIN_ID,
  TTRPG_SESSIONS_PLUGIN_ID,
  TTRPG_DASHBOARD_PLUGIN_ID,
  LIFE_OS_DASHBOARD_PLUGIN_ID,
  LIFE_OS_EXPLORER_PLUGIN_ID,
  LIFE_OS_PORTABILITY_PLUGIN_ID,
  LIFE_OS_RELATIONS_PLUGIN_ID,
  LIFE_OS_REVIEW_PLUGIN_ID,
  MEAL_PLANNER_PLUGIN_ID,
  MEDIA_LIBRARY_PLUGIN_ID,
  MEDIA_TYPE_PLUGIN_IDS,
  NOTES_PLUGIN_ID,
  PARA_CORE_PLUGIN_ID,
  PLANNER_PLUGIN_ID,
  ROUTINES_PLUGIN_ID,
  WORKOUT_PLANNER_PLUGIN_ID,
} from '../../plugins';
import { NOTES_NODES, createCoreCatalog } from '../../../blueprint/nodeCatalog';
import { validateIR } from '../../../blueprint/blueprintIR';
import { LIFE_PLUGIN_CONFIGS } from '../../lifeConfigs';
import { MEDIA_TYPE_PLUGIN_DEFINITIONS } from '../../mediaLibrary';

const manifest = (id: string) => CATALOG.find((m) => m.id === id);

describe('packs catalog', () => {
  it('has no remaining metadata-only coming-soon plugins', () => {
    expect(CATALOG.filter((plugin) => !isRunnable(plugin)).map((plugin) => plugin.id)).toEqual([]);
  });

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
    for (const pack of PACKS) expect(new Set(pack.pluginIds).size, pack.id).toBe(pack.pluginIds.length);
  });

  it('offers the ten cross-domain packs assembled from current plugins', () => {
    const ids = [
      'pack-health-training',
      'pack-home-operations',
      'pack-reading-learning',
      'pack-film-screen',
      'pack-relationships-social-life',
      'pack-creative-studio',
      'pack-digital-archive',
      'pack-collectors-cabinet',
      'pack-freelancer-toolkit',
      'pack-travel-journal',
    ];
    expect(PACKS.filter((pack) => ids.includes(pack.id)).map((pack) => pack.id)).toEqual(ids);
    expect(PACKS.find((pack) => pack.id === 'pack-health-training')?.pluginIds).toEqual(expect.arrayContaining([HEALTH_TRACKER_PLUGIN_ID, WORKOUT_PLANNER_PLUGIN_ID, MEAL_PLANNER_PLUGIN_ID, ROUTINES_PLUGIN_ID]));
    expect(PACKS.find((pack) => pack.id === 'pack-reading-learning')?.pluginIds).toEqual(expect.arrayContaining([EDUCATION_CORE_PLUGIN_ID, NOTES_PLUGIN_ID, PARA_CORE_PLUGIN_ID]));
  });

  it('includes the specialist life planners in Modified PARA', () => {
    const para = PACKS.find((pack) => pack.id === 'pack-modified-para');
    expect(para?.pluginIds).toEqual(expect.arrayContaining([ROUTINES_PLUGIN_ID, MEAL_PLANNER_PLUGIN_ID, WORKOUT_PLANNER_PLUGIN_ID, MEDIA_LIBRARY_PLUGIN_ID]));
  });

  it('bundles the shared library and every focused media type plugin', () => {
    const media = PACKS.find((pack) => pack.id === 'pack-media-library');
    expect(media?.pluginIds).toEqual([MEDIA_LIBRARY_PLUGIN_ID, ...MEDIA_TYPE_PLUGIN_IDS]);
    expect(media?.pluginIds).toHaveLength(MEDIA_TYPE_PLUGIN_IDS.length + 1);
  });

  it('loads every focused media plugin into the dedicated Media hub', async () => {
    for (const [index, definition] of MEDIA_TYPE_PLUGIN_DEFINITIONS.entries()) {
      const mediaManifest = manifest(definition.pluginId);
      expect(mediaManifest?.dependencies).toEqual([MEDIA_LIBRARY_PLUGIN_ID]);
      const views: ViewContribution[] = [];
      const context: PluginContext = {
        state: async () => { throw new Error("State not used by this fixture"); },
        addView: (view) => { views.push(view); },
        addNotePanel: () => undefined,
        addNoteFence: () => undefined,
        addEditorAction: () => undefined,
        addBlueprintNode: () => undefined,
      };
      const module = await mediaManifest!.load!();
      const plugin = 'default' in module ? module.default : module;
      await plugin.activate(context);
      expect(views).toEqual([expect.objectContaining({
        id: definition.pluginId,
        label: definition.label,
        order: 141 + index,
        mode: 'media',
        section: definition.family,
      })]);
    }
  });

  it('installs Planner before Routines & Habits', () => {
    expect(manifest(ROUTINES_PLUGIN_ID)?.dependencies).toContain(PLANNER_PLUGIN_ID);
  });

  it('bundles every specialist life store in both life and expanded PARA packs', () => {
    const lifeIds = LIFE_PLUGIN_CONFIGS.map((config) => config.id);
    const life = PACKS.find((pack) => pack.id === 'pack-personal-life');
    const para = PACKS.find((pack) => pack.id === 'pack-modified-para');
    expect(life?.pluginIds).toEqual(expect.arrayContaining(lifeIds));
    expect(para?.pluginIds).toEqual(expect.arrayContaining(lifeIds));
  });

  it('keeps the Education System focused on the five first-release plugins', () => {
    const education = PACKS.find((pack) => pack.id === 'pack-education-system');
    expect(education?.pluginIds).toEqual([
      EDUCATION_CORE_PLUGIN_ID,
      EDUCATION_CURRICULUM_PLUGIN_ID,
      EDUCATION_STUDY_PLUGIN_ID,
      EDUCATION_ASSIGNMENTS_PLUGIN_ID,
      EDUCATION_DASHBOARD_PLUGIN_ID,
    ]);
    expect(education?.pluginIds.some((id) => id.includes('migrat'))).toBe(false);
  });

  it('bundles the Information Intake Modes workflow without a migrator', () => {
    const research = PACKS.find((pack) => pack.id === 'pack-research-lab');
    expect(research?.pluginIds).toEqual(expect.arrayContaining([
      INFORMATION_INTAKE_PLUGIN_ID,
      PLANNER_PLUGIN_ID,
    ]));
    expect(research?.pluginIds.some((id) => id.includes('migrat'))).toBe(false);
  });

  it('bundles the full hobby operating loop without a migrator', () => {
    const hobbies = PACKS.find((pack) => pack.id === 'pack-full-stack-hobbies');
    expect(hobbies?.pluginIds).toEqual(expect.arrayContaining([
      HOBBY_STACK_PLUGIN_ID,
      HOBBY_PRACTICE_PLUGIN_ID,
      HOBBY_FUN_PLUGIN_ID,
      HOBBY_DASHBOARD_PLUGIN_ID,
      PLANNER_PLUGIN_ID,
      MEAL_PLANNER_PLUGIN_ID,
      WORKOUT_PLANNER_PLUGIN_ID,
      MEDIA_LIBRARY_PLUGIN_ID,
    ]));
    expect(hobbies?.pluginIds.some((id) => id.includes('migrat'))).toBe(false);
  });

  it('bundles the music maker workflow', () => {
    const music = PACKS.find((pack) => pack.id === 'pack-music-maker');
    expect(music?.pluginIds).toEqual(expect.arrayContaining([MUSIC_PROJECTS_PLUGIN_ID, MUSIC_PRACTICE_PLUGIN_ID, MUSIC_LIBRARY_PLUGIN_ID, MUSIC_DASHBOARD_PLUGIN_ID, PLANNER_PLUGIN_ID]));
  });

  it('bundles the electronics workbench workflow', () => {
    const electronics = PACKS.find((pack) => pack.id === 'pack-electronics-workbench');
    expect(electronics?.pluginIds).toEqual(expect.arrayContaining([ELECTRONICS_PROJECTS_PLUGIN_ID, ELECTRONICS_PARTS_PLUGIN_ID, ELECTRONICS_LAB_PLUGIN_ID, ELECTRONICS_DASHBOARD_PLUGIN_ID, PLANNER_PLUGIN_ID]));
  });

  it('bundles the three specialist hobby workflows', () => {
    expect(PACKS.find((pack) => pack.id === 'pack-homelab-infrastructure')?.pluginIds).toEqual(expect.arrayContaining([HOMELAB_ASSETS_PLUGIN_ID, HOMELAB_OPERATIONS_PLUGIN_ID, HOMELAB_DASHBOARD_PLUGIN_ID, PLANNER_PLUGIN_ID]));
    expect(PACKS.find((pack) => pack.id === 'pack-wardrobe-style')?.pluginIds).toEqual(expect.arrayContaining([WARDROBE_CLOSET_PLUGIN_ID, STYLE_STUDIO_PLUGIN_ID, WARDROBE_DASHBOARD_PLUGIN_ID, PLANNER_PLUGIN_ID]));
    expect(PACKS.find((pack) => pack.id === 'pack-ttrpg-campaign-studio')?.pluginIds).toEqual(expect.arrayContaining([TTRPG_CAMPAIGNS_PLUGIN_ID, TTRPG_WORLD_PLUGIN_ID, TTRPG_SESSIONS_PLUGIN_ID, TTRPG_DASHBOARD_PLUGIN_ID, PLANNER_PLUGIN_ID]));
  });

  it('bundles the complete Life OS integration layer without coupling every specialist store', () => {
    const lifeOs = PACKS.find((pack) => pack.id === 'pack-life-os-integration-portability');
    expect(lifeOs?.pluginIds).toEqual([
      LIFE_OS_EXPLORER_PLUGIN_ID,
      LIFE_OS_RELATIONS_PLUGIN_ID,
      LIFE_OS_REVIEW_PLUGIN_ID,
      LIFE_OS_PORTABILITY_PLUGIN_ID,
      LIFE_OS_DASHBOARD_PLUGIN_ID,
    ]);
    expect(lifeOs?.pluginIds.some((id) => id.includes('migrat'))).toBe(false);
  });

  it('bundles the complete Business Administration workflow with the existing German business plugins', () => {
    const business = PACKS.find((pack) => pack.id === 'pack-business-administration');
    expect(business?.pluginIds).toEqual(expect.arrayContaining([
      BUSINESS_DIRECTORY_PLUGIN_ID,
      BUSINESS_CONTRACTS_PLUGIN_ID,
      BUSINESS_RECONCILIATION_PLUGIN_ID,
      BUSINESS_OBLIGATIONS_PLUGIN_ID,
      BUSINESS_OPERATIONS_PLUGIN_ID,
      BUSINESS_DASHBOARD_PLUGIN_ID,
      PLANNER_PLUGIN_ID,
    ]));
  });

  it('bundles only the read-only audit-core viewer plugins', () => {
    const audit = PACKS.find((pack) => pack.id === 'pack-audit-core-viewer');
    expect(audit?.pluginIds).toEqual([
      AUDIT_CORE_BROWSER_PLUGIN_ID,
      AUDIT_CORE_OVERVIEW_PLUGIN_ID,
      AUDIT_CORE_SCOPE_PLUGIN_ID,
      AUDIT_CORE_THREATS_PLUGIN_ID,
      AUDIT_CORE_FINDINGS_PLUGIN_ID,
      AUDIT_CORE_TESTS_PLUGIN_ID,
      AUDIT_CORE_REPORT_PLUGIN_ID,
      AUDIT_CORE_REMEDIATION_PLUGIN_ID,
    ]);
    expect(audit?.pluginIds.some((id) => ['findings-tracker', 'audit-checklists', 'vuln-kb', 'audit-reports', 'kanban'].includes(id))).toBe(false);
  });
});

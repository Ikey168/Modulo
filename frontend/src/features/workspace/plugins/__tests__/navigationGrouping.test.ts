import { INTAKE_MODES } from '../../informationIntake';
import { RESEARCH_ROLE_IDS } from '../../researchRoles';
import { PLUGINS } from '../../plugins';
import { beforeEach, describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { activeModes, hubTabs, sidebarViews, viewSectionLabel, modeInfo, canonicalMode, HUB_SECTIONS } from '../modes';
import { PluginRuntime } from '../runtime';

beforeEach(() => localStorage.clear());

describe('installed-plugin navigation grouping', () => {
  it('upgrades an existing workflow installation into independent role plugins', async () => {
    const runtime = new PluginRuntime(CATALOG, undefined, {
      load: () => [{ id: 'research-workflow-engine', enabled: true }],
      save: async () => {},
    });
    await runtime.init();
    for (const id of [...RESEARCH_ROLE_IDS, 'daily-briefing', 'topic-watchlists', 'newsletter-inbox']) expect(runtime.isActive(id), id).toBe(true);
    expect(runtime.contributions().views.some(view => view.id === 'research-overview')).toBe(false);
    await runtime.dispose();
  });

  it('keeps the main rail compact when the entire catalog is installed', async () => {
    const runtime = new PluginRuntime(CATALOG);
    await runtime.init();
    for (const plugin of CATALOG) await runtime.install(plugin.id);

    const views = runtime.contributions().views;
    expect(sidebarViews(views)).toEqual([]);
    expect(activeModes(views).map((mode) => mode.id)).toEqual([
      'knowledge',
      'life',
      'media',
      'productivity',
      'hobbies',
      'work',
      'tools',
    ]);
    expect(modeInfo('knowledge')?.label).toBe('Knowledge');
    const researchTabs = hubTabs(views, 'research');
    const separateIds = ['notes', 'graph', 'canvas', 'tags', 'saved-searches'];
    expect(researchTabs.slice(0, 5).map(view => view.id)).toEqual(separateIds);
    expect(researchTabs.slice(0, 5).map(viewSectionLabel)).toEqual(separateIds.map(() => 'Notes & Tools'));
    expect(modeInfo('knowledge-tools')?.id).toBe('knowledge');
    for (const [id, section] of [
      ['daily-briefing', 'Awareness'],
      ['topic-watchlists', 'Awareness'],
      ['newsletter-inbox', 'Awareness'],
      ['research-problems', 'Problem-Solving'],
      ['decision-journal', 'Decision Support'],
      ['executable-runbooks', 'Externalization'],
      ['timeline', 'Maintenance'],
      ['feeds-reading-inbox', 'Awareness'],
      ['web-watch', 'Awareness'],
      ['education-core', 'Internalization'],
      ['flashcards-spaced-repetition', 'Internalization'],
      ['evidence-library', 'Deep Research'],
      ['evidence-reproducibility', 'Iteration'],
      ['research-maintenance', 'Maintenance'],
    ]) {
      const tab = researchTabs.find((view) => view.id === id);
      expect(tab, `${id} should be directly accessible`).toBeDefined();
      expect(viewSectionLabel(tab!)).toBe(section);
    }
    // Cover every installed contribution, including views nested under a
    // workflow overview, so new plugins cannot restore the old groupings.
    const workflowStages = HUB_SECTIONS.knowledge.map((stage) => stage.label);
    for (const view of views.filter((view) => view.mode && canonicalMode(view.mode) === 'knowledge')) {
      expect(workflowStages, `${view.id} must belong to a workflow stage`).toContain(viewSectionLabel(view));
    }
    expect(workflowStages).toEqual(['Notes & Tools', ...INTAKE_MODES]);
    expect(views.some(view => ['research-overview', 'research-signals', 'information-dashboard'].includes(view.id))).toBe(false);
    expect(PLUGINS.some(plugin => ['research-workflow-engine', 'information-dashboard'].includes(plugin.id))).toBe(false);
    expect(workflowStages).not.toContain('Notes');
    expect(workflowStages).not.toContain('Organize');
    const sections = researchTabs.map(viewSectionLabel).filter(Boolean);
    expect(sections).not.toContain('Research Workflow');
    // Each stage is one contiguous group on desktop and in the phone menu.
    const headings = sections.filter((section, index) => section !== sections[index - 1]);
    expect(headings.length).toBe(new Set(headings).size);
    const planningTabs = hubTabs(views, 'productivity');
    expect(planningTabs.some((view) => view.id === 'calendar')).toBe(false);
    expect(planningTabs.find((view) => view.id === 'planner')?.label).toBe('Planner & Calendar');

    expect(hubTabs(views, 'media').map((view) => view.id)).toEqual([
      'media-library',
      'media-diary-reviews',
      'lists-rankings',
      'metadata-artwork-resolver',
      'media-books',
      'media-ebooks',
      'media-short-stories',
      'media-novellas',
      'media-essays',
      'media-articles',
      'media-comics-graphic-novels',
      'media-manga',
      'media-magazines-zines',
      'media-poetry',
      'media-photography',
      'media-visual-art',
      'media-graphic-design',
      'media-architecture',
      'media-product-design',
      'media-illustration',
      'media-movies',
      'media-tv-series',
      'media-documentaries',
      'media-short-films',
      'media-animation',
      'media-music-videos',
      'media-experimental-film',
      'media-youtube-videos',
      'media-web-series',
      'media-commercials-titles',
      'media-courses',
      'media-audiobooks',
      'media-albums',
      'media-songs',
      'media-podcasts',
      'media-radio-drama',
      'media-radio-documentaries',
      'media-dj-mixes',
      'media-live-recordings',
      'media-interviews',
      'media-speeches-lectures',
      'media-debates',
      'media-oral-histories',
      'media-readings',
      'media-video-games',
      'media-board-games',
      'media-ttrpgs',
      'media-card-games',
      'media-puzzles',
      'media-args',
      'media-theatre',
      'media-musicals',
      'media-opera',
      'media-dance',
      'media-concerts',
      'media-performance-art',
      'media-circus',
      'media-magic',
      'media-live-performances',
      'media-standup',
    ]);

    const dailyLifeSections = hubTabs(views, 'life')
      .filter((view) => view.mode === 'life')
      .map(viewSectionLabel)
      .filter((section, index, sections) => section && section !== sections[index - 1]);
    expect(dailyLifeSections).toEqual([
      'Home & Wellbeing',
      'Finance & Wealth',
      'People & Leisure',
    ]);

    expect(hubTabs(views, 'para').filter((view) => view.mode === 'para').map((view) => [view.id, view.label])).toEqual([
      ['para-dashboard', 'Dashboard'],
      ['para-capture', 'Capture'],
      ['para-tasks', 'Tasks'],
      ['para-projects', 'Projects'],
      ['para-areas', 'Areas'],
      ['para-goals', 'Arcs'],
      ['para-resources', 'Resources'],
      ['para-review', 'Review'],
      ['para-archive', 'Archive'],
      ['para-migration', 'Migrate'],
    ]);
  }, 30_000);
});

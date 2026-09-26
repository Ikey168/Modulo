import { beforeEach, describe, expect, it } from 'vitest';
import { FileText } from 'lucide-react';
import {
  activeModes,
  hubTabs,
  isHubMode,
  modeInfo,
  modeOfView,
  modeSectionLabel,
  viewSectionLabel,
  resolveHubTab,
  sidebarViews,
} from '../plugins/modes';
import type { ViewContribution } from '../plugins/types';

const view = (id: string, order: number, mode?: string, parentViewId?: string, section?: string): ViewContribution => ({
  id,
  label: id,
  icon: FileText,
  order,
  component: () => null,
  mode,
  parentViewId,
  section,
});

const VIEWS: ViewContribution[] = [
  view('standalone', 5),
  view('notes', 10, 'knowledge-tools'),
  view('graph', 20, 'knowledge-tools'),
  view('para-dashboard', 40, 'para'),
  view('health', 40, 'life'),
  view('life-os-dashboard', 10, 'life-os'),
  view('media-library', 140, 'media'),
  view('calendar', 70, 'productivity', 'planner'),
  view('planner', 60, 'productivity'),
  view('findings', 40, 'audit'),
  view('business-dashboard', 10, 'business'),
  view('music-dashboard', 10, 'music'),
  view('education-dashboard', 10, 'education'),
  view('information-intake', 10, 'research'),
  view('evidence-dashboard', 10, 'evidence'),
  view('writing-dashboard', 10, 'writing'),
];

beforeEach(() => localStorage.clear());

describe('mode partition', () => {
  it('sidebarViews returns only mode-less views', () => {
    expect(sidebarViews(VIEWS).map((v) => v.id)).toEqual(['standalone']);
  });

  it('orders research tools by workflow stage while preserving legacy routes', () => {
    expect(hubTabs(VIEWS, 'knowledge').map((v) => v.id)).toEqual([
      'notes',
      'graph',
      'information-intake',
      'evidence-dashboard',
      'writing-dashboard',
      'education-dashboard',
    ]);
  });

  it('combines Life domains into one sectioned hub while keeping Planning separate', () => {
    expect(hubTabs(VIEWS, 'life').map((v) => v.id)).toEqual([
      'para-dashboard',
      'health',
      'life-os-dashboard',
    ]);
    expect(hubTabs(VIEWS, 'para')).toEqual(hubTabs(VIEWS, 'life'));
    expect(hubTabs(VIEWS, 'life-os')).toEqual(hubTabs(VIEWS, 'life'));
    expect(hubTabs(VIEWS, 'productivity').map((v) => v.id)).toEqual(['planner']);
  });

  it('keeps the consolidated Life sections contiguous instead of one Daily Life bucket', () => {
    const tabs = hubTabs([
      view('journal', 10, 'life', undefined, 'People & Leisure'),
      view('finance', 20, 'life', undefined, 'Finance & Wealth'),
      view('routines', 30, 'life', undefined, 'Home & Wellbeing'),
      view('home', 40, 'life', undefined, 'Home & Wellbeing'),
      view('people', 50, 'life', undefined, 'People & Leisure'),
      view('meals', 60, 'life', undefined, 'Home & Wellbeing'),
      view('wishlist', 70, 'life', undefined, 'Finance & Wealth'),
    ], 'life');

    expect(tabs.map((tab) => tab.id)).toEqual([
      'routines',
      'home',
      'meals',
      'finance',
      'wishlist',
      'journal',
      'people',
    ]);
    expect(tabs.map(viewSectionLabel)).not.toContain('Daily Life');
  });

  it('activeModes emits only umbrella hubs, in nav order', () => {
    expect(activeModes(VIEWS).map((m) => m.id)).toEqual(['knowledge', 'life', 'media', 'productivity', 'hobbies', 'work']);
    expect(activeModes([view('notes', 40)])).toEqual([]);
  });

  it('modeOfView resolves a tab to its mode and sidebar/unknown views to undefined', () => {
    expect(modeOfView(VIEWS, 'calendar')).toBe('productivity');
    expect(modeOfView(VIEWS, 'para-dashboard')).toBe('life');
    expect(modeOfView(VIEWS, 'life-os-dashboard')).toBe('life');
    expect(modeOfView(VIEWS, 'notes')).toBe('knowledge');
    expect(modeOfView(VIEWS, 'findings')).toBe('work');
    expect(modeOfView(VIEWS, 'standalone')).toBeUndefined();
    expect(modeOfView(VIEWS, 'nope')).toBeUndefined();
  });

  it('isHubMode knows the builtin hub modes', () => {
    expect(isHubMode('para')).toBe(true);
    expect(isHubMode('life')).toBe(true);
    expect(isHubMode('education')).toBe(true);
    expect(isHubMode('research')).toBe(true);
    expect(isHubMode('hobbies')).toBe(true);
    expect(isHubMode('music')).toBe(true);
    expect(isHubMode('media')).toBe(true);
    expect(isHubMode('electronics')).toBe(true);
    expect(isHubMode('homelab')).toBe(true);
    expect(isHubMode('style')).toBe(true);
    expect(isHubMode('ttrpg')).toBe(true);
    expect(isHubMode('life-os')).toBe(true);
    expect(isHubMode('audit')).toBe(true);
    expect(isHubMode('business')).toBe(true);
    expect(isHubMode('security')).toBe(true);
    expect(isHubMode('wealth')).toBe(true);
    expect(isHubMode('evidence')).toBe(true);
    expect(isHubMode('career')).toBe(true);
    expect(isHubMode('writing')).toBe(true);
    expect(isHubMode('mobility')).toBe(true);
    expect(isHubMode('knowledge')).toBe(true);
    expect(isHubMode('work')).toBe(true);
    expect(isHubMode('notes')).toBe(false);
  });

  it('keeps all legacy domain routes pointed at their umbrella hubs', () => {
    expect(modeInfo('para')?.id).toBe('life');
    expect(modeInfo('life-os')?.id).toBe('life');
    expect(modeInfo('productivity')?.id).toBe('productivity');
    expect(modeInfo('music')?.id).toBe('hobbies');
    expect(modeInfo('education')?.id).toBe('knowledge');
    expect(modeInfo('research')?.id).toBe('knowledge');
    expect(modeInfo('evidence')?.id).toBe('knowledge');
    expect(modeInfo('writing')?.id).toBe('knowledge');
    expect(modeInfo('audit')?.id).toBe('work');
    expect(modeSectionLabel('wealth')).toBe('Finance & Wealth');
    expect(modeSectionLabel('ttrpg')).toBe('TTRPG');
    expect(viewSectionLabel(view('audit-core-findings', 10, 'audit'))).toBe('Audit Core Output');
    expect(viewSectionLabel(view('findings', 20, 'audit'))).toBe('Audit Workspace');
  });
});

describe('last-tab selection', () => {
  it('resolveHubTab falls back to the first tab when the remembered one is gone', () => {
    const tabs = hubTabs(VIEWS, 'productivity');
    expect(resolveHubTab(tabs, 'productivity', 'planner')?.id).toBe('planner');
    expect(resolveHubTab(tabs, 'productivity', 'uninstalled-tab')?.id).toBe('planner');
    expect(resolveHubTab([], 'productivity')).toBeUndefined();
  });
});

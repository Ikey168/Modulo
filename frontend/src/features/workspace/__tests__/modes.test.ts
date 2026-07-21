import { beforeEach, describe, expect, it } from 'vitest';
import { FileText } from 'lucide-react';
import {
  activeModes,
  hubTabs,
  isHubMode,
  modeOfView,
  readLastTab,
  resolveHubTab,
  sidebarViews,
  writeLastTab,
} from '../plugins/modes';
import type { ViewContribution } from '../plugins/types';

const view = (id: string, order: number, mode?: string): ViewContribution => ({
  id,
  label: id,
  icon: FileText,
  order,
  component: () => null,
  mode,
});

const VIEWS: ViewContribution[] = [
  view('notes', 40),
  view('graph', 50),
  view('calendar', 70, 'productivity'),
  view('planner', 60, 'productivity'),
  view('findings', 40, 'audit'),
];

beforeEach(() => localStorage.clear());

describe('mode partition', () => {
  it('sidebarViews returns only mode-less views', () => {
    expect(sidebarViews(VIEWS).map((v) => v.id)).toEqual(['notes', 'graph']);
  });

  it('hubTabs filters by mode and sorts by order', () => {
    expect(hubTabs(VIEWS, 'productivity').map((v) => v.id)).toEqual(['planner', 'calendar']);
  });

  it('activeModes only lists modes with at least one view, in nav order', () => {
    expect(activeModes(VIEWS).map((m) => m.id)).toEqual(['productivity', 'audit']);
    expect(activeModes([view('notes', 40)])).toEqual([]);
  });

  it('modeOfView resolves a tab to its mode and sidebar/unknown views to undefined', () => {
    expect(modeOfView(VIEWS, 'calendar')).toBe('productivity');
    expect(modeOfView(VIEWS, 'notes')).toBeUndefined();
    expect(modeOfView(VIEWS, 'nope')).toBeUndefined();
  });

  it('isHubMode knows the builtin hub modes', () => {
    expect(isHubMode('audit')).toBe(true);
    expect(isHubMode('business')).toBe(true);
    expect(isHubMode('notes')).toBe(false);
  });
});

describe('last-tab persistence', () => {
  it('round-trips per mode', () => {
    writeLastTab('productivity', 'calendar');
    writeLastTab('audit', 'findings');
    expect(readLastTab('productivity')).toBe('calendar');
    expect(readLastTab('audit')).toBe('findings');
  });

  it('returns null for unknown modes and corrupt storage', () => {
    expect(readLastTab('business')).toBeNull();
    localStorage.setItem('modulo-hub-tabs', '{ not json');
    expect(readLastTab('productivity')).toBeNull();
  });

  it('resolveHubTab falls back to the first tab when the remembered one is gone', () => {
    const tabs = hubTabs(VIEWS, 'productivity');
    writeLastTab('productivity', 'calendar');
    expect(resolveHubTab(tabs, 'productivity')?.id).toBe('calendar');
    writeLastTab('productivity', 'uninstalled-tab');
    expect(resolveHubTab(tabs, 'productivity')?.id).toBe('planner');
    expect(resolveHubTab([], 'productivity')).toBeUndefined();
  });
});

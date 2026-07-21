// Workspace modes (#369). A view contribution may declare a `mode`; such views
// render as tabs inside that mode's hub instead of adding sidebar items. A mode
// is only offered while at least one active view targets it, so a vault with no
// audit plugins installed never shows an Audit mode. Pure helpers live here so
// they can be unit-tested without the shell.

import { Briefcase, CalendarCheck, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { ViewContribution } from './types';

export interface ModeInfo {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Position among nav entries, same scale as view `order`. */
  order: number;
}

export const HUB_MODES: ModeInfo[] = [
  { id: 'productivity', label: 'Productivity', icon: CalendarCheck, order: 42 },
  { id: 'audit', label: 'Audit', icon: ShieldCheck, order: 44 },
  { id: 'business', label: 'Business', icon: Briefcase, order: 46 },
];

export function modeInfo(id: string): ModeInfo | undefined {
  return HUB_MODES.find((m) => m.id === id);
}

export const isHubMode = (id: string): boolean => HUB_MODES.some((m) => m.id === id);

/** Views that render in the classic Workspace sidebar (no mode declared). */
export function sidebarViews(views: ViewContribution[]): ViewContribution[] {
  return views.filter((v) => !v.mode);
}

/** One mode's hub tabs, ordered by the contribution `order`. */
export function hubTabs(views: ViewContribution[], mode: string): ViewContribution[] {
  return views.filter((v) => v.mode === mode).sort((a, b) => a.order - b.order);
}

/** The modes that currently have at least one active view, in nav order. */
export function activeModes(views: ViewContribution[]): ModeInfo[] {
  return HUB_MODES.filter((m) => views.some((v) => v.mode === m.id));
}

/** Mode of a view id, or undefined for sidebar views and unknown ids. */
export function modeOfView(views: ViewContribution[], viewId: string): string | undefined {
  return views.find((v) => v.id === viewId)?.mode;
}

// ── Last-active-tab persistence ──────────────────────────────────────────────
// One record for all modes, consistent with how plugin install state and the
// canvas layout are stored.

const TAB_KEY = 'modulo-hub-tabs';

export function readLastTab(mode: string): string | null {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const tab = (parsed as Record<string, unknown>)[mode];
    return typeof tab === 'string' ? tab : null;
  } catch {
    return null;
  }
}

export function writeLastTab(mode: string, tab: string): void {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    let parsed: Record<string, unknown> = {};
    if (raw) {
      const p: unknown = JSON.parse(raw);
      if (typeof p === 'object' && p !== null) parsed = p as Record<string, unknown>;
    }
    parsed[mode] = tab;
    localStorage.setItem(TAB_KEY, JSON.stringify(parsed));
  } catch {
    // Storage unavailable — the hub simply opens on its first tab.
  }
}

/** The tab a hub should open on: last active if still present, else first. */
export function resolveHubTab(tabs: ViewContribution[], mode: string): ViewContribution | undefined {
  const last = readLastTab(mode);
  return tabs.find((t) => t.id === last) ?? tabs[0];
}

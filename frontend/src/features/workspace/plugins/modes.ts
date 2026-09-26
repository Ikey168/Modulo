// Workspace modes (#369). Fine-grained plugin modes are aliases of a small set
// of durable sidebar hubs. The original ids remain valid routes and storage
// keys, while the main rail stays compact as more plugins are installed.

import { BookMarked, BookOpen, BriefcaseBusiness, CalendarCheck, Gamepad2, Heart, Wrench, type LucideIcon } from 'lucide-react';
import type { ViewContribution } from './types';

export interface ModeInfo {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Position among nav entries, same scale as view `order`. */
  order: number;
}

export const HUB_MODES: ModeInfo[] = [
  { id: 'knowledge', label: 'Knowledge', icon: BookMarked, order: 35 },
  { id: 'life', label: 'Life', icon: Heart, order: 40 },
  { id: 'media', label: 'Media', icon: BookOpen, order: 41 },
  { id: 'productivity', label: 'Planning', icon: CalendarCheck, order: 42 },
  { id: 'hobbies', label: 'Hobbies', icon: Gamepad2, order: 43 },
  { id: 'work', label: 'Work', icon: BriefcaseBusiness, order: 48 },
  { id: 'tools', label: 'Tools', icon: Wrench, order: 60 },
];

export interface ModeSection {
  id: string;
  label: string;
}

/** Fine-grained domains shown as headings in each hub's secondary sidebar. */
export const HUB_SECTIONS: Record<string, readonly ModeSection[]> = {
  knowledge: [
    { id: 'knowledge-tools', label: 'Notes & Tools' },
    { id: 'reading-capture', label: 'Awareness' },
    { id: 'exploration', label: 'Exploration' },
    { id: 'evidence', label: 'Deep Research' },
    { id: 'decisions', label: 'Decision Support' },
    { id: 'problem-solving', label: 'Problem-Solving' },
    { id: 'writing', label: 'Creation' },
    { id: 'externalization', label: 'Externalization' },
    { id: 'education', label: 'Internalization' },
    { id: 'iteration', label: 'Iteration' },
    { id: 'maintenance', label: 'Maintenance' },
  ],
  life: [
    { id: 'para', label: 'PARA' },
    { id: 'life-home', label: 'Home & Wellbeing' },
    { id: 'wealth', label: 'Finance & Wealth' },
    { id: 'life-personal', label: 'People & Leisure' },
    { id: 'life-os', label: 'Life OS' },
    { id: 'security', label: 'Security & Identity' },
    { id: 'mobility', label: 'Travel & Mobility' },
  ],
  media: [
    { id: 'media-library', label: 'Library' },
    { id: 'Written', label: 'Written' },
    { id: 'Seen', label: 'Seen' },
    { id: 'Watched', label: 'Watched' },
    { id: 'Listened', label: 'Listened' },
    { id: 'Spoken', label: 'Spoken' },
    { id: 'Played', label: 'Played' },
    { id: 'Live', label: 'Live' },
  ],
  productivity: [{ id: 'productivity', label: 'Planning' }],
  hobbies: [
    { id: 'hobbies', label: 'Hobby Studio' },
    { id: 'music', label: 'Music' },
    { id: 'electronics', label: 'Electronics' },
    { id: 'homelab', label: 'Homelab' },
    { id: 'style', label: 'Wardrobe & Style' },
    { id: 'ttrpg', label: 'TTRPG' },
  ],
  work: [
    { id: 'audit', label: 'Smart Contract Auditing' },
    { id: 'business', label: 'Business Admin' },
    { id: 'career', label: 'Career' },
  ],
  tools: [{ id: 'tools', label: 'Tools' }],
};

const MODE_TO_HUB = new Map<string, string>();
for (const hub of HUB_MODES) {
  MODE_TO_HUB.set(hub.id, hub.id);
  for (const section of HUB_SECTIONS[hub.id] ?? []) MODE_TO_HUB.set(section.id, hub.id);
}

// Preserve the former organization route after replacing its sidebar section.
MODE_TO_HUB.set('organize', 'knowledge');
MODE_TO_HUB.set('research', 'knowledge');

export function canonicalMode(id: string): string {
  return MODE_TO_HUB.get(id) ?? id;
}

export function modeSectionLabel(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const hub = canonicalMode(id);
  if (id === 'knowledge') return 'Deep Research';
  if (id === 'organize') return 'Maintenance';
  return HUB_SECTIONS[hub]?.find((section) => section.id === id)?.label;
}

/** Section label for one contributed view. Audit has two intentionally
 * different workflows that would otherwise expose duplicate Findings/Reports
 * labels in one undifferentiated list. */
export function viewSectionLabel(view: ViewContribution): string | undefined {
  if (view.mode === 'knowledge-tools') return 'Notes & Tools';
  if (view.mode && canonicalMode(view.mode) === 'knowledge') {
    const stages: Record<string, string> = {
      timeline: 'Maintenance',
      'research-signals': 'Awareness', 'information-intake': 'Awareness',
      'research-projects': 'Exploration', 'information-workbench': 'Exploration',
      'research-evidence': 'Deep Research',
      'reading-annotations': 'Deep Research',
      'research-decisions': 'Decision Support', 'research-problems': 'Problem-Solving',
      'research-externalization': 'Externalization',
      'research-creation': 'Creation', 'information-outputs': 'Creation',
      'research-learning': 'Internalization',
      'research-iteration': 'Iteration',
      'research-maintenance': 'Maintenance',
      'evidence-reproducibility': 'Iteration',
    };
    if (stages[view.id]) return stages[view.id];
    if (HUB_SECTIONS.knowledge.some(stage => stage.label === view.section)) return view.section;
    if (['education', 'evidence', 'writing', 'reading-capture'].includes(view.mode)) return modeSectionLabel(view.mode);
    if (view.section === 'Reading & Capture') return 'Awareness';
    if (view.section === 'Explore') return 'Exploration';
    if (view.section === 'Organize') return 'Maintenance';
    // Contributions may explicitly select a stage; older/general knowledge
    // tools belong with the notes and evidence they operate on.
    if (HUB_SECTIONS.knowledge.some((stage) => stage.label === view.section)) return view.section;
    return modeSectionLabel(view.mode) ?? 'Deep Research';
  }
  if (view.section) return view.section;
  if (view.mode === 'audit') return view.id.startsWith('audit-core-') ? 'Audit Core Output' : 'Audit Workspace';
  return modeSectionLabel(view.mode);
}

export function modeInfo(id: string): ModeInfo | undefined {
  const canonical = canonicalMode(id);
  return HUB_MODES.find((m) => m.id === canonical);
}

export const isHubMode = (id: string): boolean => HUB_MODES.some((m) => m.id === canonicalMode(id));

/** Views that render in the classic Workspace sidebar (no mode declared). */
export function sidebarViews(views: ViewContribution[]): ViewContribution[] {
  return views.filter((v) => !v.mode);
}

/** One mode's hub tabs, ordered by the contribution `order`. */
export function hubTabs(views: ViewContribution[], mode: string): ViewContribution[] {
  const canonical = canonicalMode(mode);
  const sectionOrder = new Map<string, number>();
  for (const [index, section] of (HUB_SECTIONS[canonical] ?? []).entries()) {
    sectionOrder.set(section.id, index);
    sectionOrder.set(section.label, index);
  }
  const viewIds = new Set(views.map((view) => view.id));
  return views
    .filter((v) => v.mode && (!v.parentViewId || !viewIds.has(v.parentViewId)) && canonicalMode(v.mode) === canonical)
    .sort((a, b) => {
      const aSection = viewSectionLabel(a);
      const bSection = viewSectionLabel(b);
      const sectionDifference = (sectionOrder.get(aSection ?? '') ?? sectionOrder.get(a.mode!) ?? 0)
        - (sectionOrder.get(bSection ?? '') ?? sectionOrder.get(b.mode!) ?? 0);
      if (sectionDifference !== 0) return sectionDifference;
      return a.order - b.order;
    });
}

/** The modes that currently have at least one active view, in nav order. */
export function activeModes(views: ViewContribution[]): ModeInfo[] {
  return HUB_MODES.filter((m) => views.some((v) => v.mode && canonicalMode(v.mode) === m.id));
}

/** Mode of a view id, or undefined for sidebar views and unknown ids. */
export function modeOfView(views: ViewContribution[], viewId: string): string | undefined {
  const mode = views.find((v) => v.id === viewId)?.mode;
  return mode ? canonicalMode(mode) : undefined;
}

/** The tab a hub should open on: last active if still present, else first. */
export function resolveHubTab(tabs: ViewContribution[], _mode: string, last: string | null = null): ViewContribution | undefined {
  return tabs.find((t) => t.id === last) ?? tabs[0];
}

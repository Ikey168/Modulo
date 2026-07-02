// Single source of truth for the blueprint editor's category and pin-type
// colour metadata (#274). These accents were previously duplicated across
// BlueprintNodeView.tsx (hex literals), NodePalette.tsx (token classes), and
// editor.css; every consumer now derives from this module, so the editor
// follows the design-system tokens — and therefore every [data-theme].

import type { DataType, NodeCategory } from '../nodeModel';

/** Visual metadata for a node category, all derived from design tokens. */
export interface CategoryMeta {
  /** Design-token variable holding the accent's HSL channels (use as `hsl(var(tokenVar))`). */
  tokenVar: string;
  /** Tailwind text-colour class for the accent. */
  textClass: string;
  /** Tailwind Badge-style tinted background class (accent at 15% opacity). */
  bgClass: string;
  /** Tailwind left-accent border-colour class. */
  borderClass: string;
  /** Human label for palette group headers. */
  label: string;
}

export const CATEGORY_ORDER: NodeCategory[] = ['trigger', 'action', 'logic'];

/** trigger → success (green), action → primary (emerald), logic → warning (amber). */
export const CATEGORY_META: Record<NodeCategory, CategoryMeta> = {
  trigger: {
    tokenVar: '--success',
    textClass: 'text-success',
    bgClass: 'bg-success/15',
    borderClass: 'border-l-success',
    label: 'Triggers',
  },
  action: {
    tokenVar: '--primary',
    textClass: 'text-primary',
    bgClass: 'bg-primary/15',
    borderClass: 'border-l-primary',
    label: 'Actions',
  },
  logic: {
    tokenVar: '--warning',
    textClass: 'text-warning',
    bgClass: 'bg-warning/15',
    borderClass: 'border-l-warning',
    label: 'Logic',
  },
};

const FALLBACK_CATEGORY_META: CategoryMeta = {
  tokenVar: '--muted-foreground',
  textClass: 'text-muted-foreground',
  bgClass: 'bg-muted-foreground/15',
  borderClass: 'border-l-muted-foreground',
  label: 'Other',
};

/** Meta for a category; unknown categories get a neutral muted accent. */
export function categoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category as NodeCategory] ?? FALLBACK_CATEGORY_META;
}

/** Visual metadata for a data-pin type. */
export interface PinTypeMeta {
  /** CSS colour string — a token-derived custom property declared in editor.css. */
  color: string;
  /** Short visible text label: the non-colour affordance for the pin's type. */
  label: string;
}

const PIN_TYPE_META: Record<string, PinTypeMeta> = {
  string: { color: 'var(--bp-pin-string)', label: 'str' },
  number: { color: 'var(--bp-pin-number)', label: 'num' },
  boolean: { color: 'var(--bp-pin-boolean)', label: 'bool' },
  note: { color: 'var(--bp-pin-note)', label: 'note' },
  noteList: { color: 'var(--bp-pin-note-list)', label: 'note[]' },
  tag: { color: 'var(--bp-pin-tag)', label: 'tag' },
  link: { color: 'var(--bp-pin-link)', label: 'link' },
  user: { color: 'var(--bp-pin-user)', label: 'user' },
  any: { color: 'var(--bp-pin-any)', label: 'any' },
};

/** Meta for a pin type; unknown (plugin) types get the neutral colour and their raw name. */
export function pinTypeMeta(type: DataType): PinTypeMeta {
  return PIN_TYPE_META[type] ?? { color: 'var(--bp-pin-any)', label: type };
}

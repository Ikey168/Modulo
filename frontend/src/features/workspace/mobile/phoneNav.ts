/**
 * Which workspace destinations get a bottom-navigation slot on a phone.
 *
 * Kept apart from the components so the rule can be unit-tested without a DOM
 * and so `PhoneChrome.tsx` stays a components-only module.
 */
import type { LucideIcon } from 'lucide-react';

export interface PhoneNavEntry {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** How many destinations fit on a bottom bar before labels start truncating. */
const BOTTOM_NAV_SLOTS = 4;

/**
 * Destinations you go to in order to administer the workspace rather than to
 * work in it.
 *
 * The nav is ordered for a desktop rail, where a dozen icons all fit and the
 * tail costs nothing. A phone has four slots, and on a workspace with one or
 * two plugins installed the tail is exactly what fills them — the first build
 * of this bar offered Dashboard, Blueprints, Marketplace and *Recovery*, three
 * of which you visit about once a month. Bottom navigation is for the places
 * you switch between constantly; these are still one tap away in the drawer.
 */
const UTILITY_DESTINATIONS = new Set([
  'recovery',
  'marketplace',
  'packs',
  'pack-studio',
  'audit-pack',
  'approvals',
  'executions',
  'property-queries',
]);

/**
 * The destinations that earn a permanent bottom-bar slot.
 *
 * Content destinations keep the workspace's own order (which already puts
 * Dashboard and the hubs first); utility destinations only fill slots that
 * content has left empty. Wherever you currently *are* is always visible, even
 * when it is a drawer-only view — otherwise the bar's only "you are here"
 * indicator is the More button.
 */
export function phoneDestinations(items: PhoneNavEntry[], activeId: string): PhoneNavEntry[] {
  const content = items.filter((item) => !UTILITY_DESTINATIONS.has(item.id));
  const utility = items.filter((item) => UTILITY_DESTINATIONS.has(item.id));
  const preferred = [...content, ...utility].slice(0, BOTTOM_NAV_SLOTS);

  if (preferred.some((item) => item.id === activeId)) return preferred;
  const active = items.find((item) => item.id === activeId);
  if (!active) return preferred;
  // Keep the first destination (the home view) and surface the current one.
  return [...preferred.slice(0, BOTTOM_NAV_SLOTS - 1), active];
}

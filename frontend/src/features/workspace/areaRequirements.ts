import { newParaId, type AreaChecklistHealth, type AreaRequirement, type ParaArea } from './para';
import { specificAreaName, specificRequirements } from './areaSpecificRequirements';

export const AREA_CHECKLIST_HEALTH: AreaChecklistHealth[] = [
  'Rebuilding', 'Messy', 'Growing', 'Under Control',
];
const REQUIREMENTS_REVISION = 2;

const LEGACY_DEFAULT_REQUIREMENTS: Record<AreaChecklistHealth, string[]> = {
  Rebuilding: [
    'The most urgent problem is identified and contained.',
    'A realistic first step to restore this area is scheduled.',
    'Support, tools, or time needed for recovery are available.',
  ],
  Messy: [
    'The ongoing responsibilities in this area are clear.',
    'Open issues and neglected commitments are written down.',
    'Each important issue has a next action or decision.',
  ],
  Growing: [
    'A workable routine is being followed consistently.',
    'There is recent evidence of progress.',
    'The next improvement is specific and achievable.',
  ],
  'Under Control': [
    'Recurring responsibilities are handled on time.',
    'The standard for this area is being met.',
    'A regular review is in place to catch new problems.',
  ],
};

function legacySupport(name: string, health: AreaChecklistHealth): string {
  const support = {
    Rebuilding: `A first recovery action for ${name} is scheduled.`,
    Messy: `The open issues in ${name} each have a next action.`,
    Growing: `Recent progress in ${name} is recorded.`,
    'Under Control': `${name} has a regular review to catch new issues.`,
  };
  return support[health];
}

export function requirementsFor(area: ParaArea, health: AreaChecklistHealth): AreaRequirement[] {
  const prefix = health.toLowerCase().replaceAll(' ', '-');
  const defaults = specificRequirements(area, health).map((text, index) => ({
    id: index === 0 ? `${prefix}-0` : `${prefix}-detail-${index}`,
    text,
    done: false,
  }));
  const stored = area.requirements?.[health];
  if (!stored) return defaults;
  // An empty list was deliberately cleared. Once upgraded, deletions stay deleted.
  if (stored.length === 0 || (area.requirementsRevision?.[health] ?? 0) >= REQUIREMENTS_REVISION) return stored;
  let replaceSharedFirst = false;
  const preserved = stored.flatMap((item) => {
    const index = Number(item.id.slice(`${prefix}-`.length));
    const shared = item.id === `${prefix}-${index}` && (
      item.text === LEGACY_DEFAULT_REQUIREMENTS[health][index]
      || (index === 1 && [area.name, specificAreaName(area)].some((name) => item.text === legacySupport(name, health)))
    );
    if (shared) {
      if (index === 0) replaceSharedFirst = true;
      // A checked older criterion remains checked, without checking a new standard.
      return item.done ? [{ ...item, id: `legacy-${item.id}` }] : [];
    }
    return [item];
  });
  if (replaceSharedFirst) preserved.unshift(defaults[0]);
  const ids = new Set(preserved.map((item) => item.id));
  return [...preserved, ...defaults.slice(1).filter((item) => !ids.has(item.id))];
}

export function withRequirements(
  area: ParaArea,
  health: AreaChecklistHealth,
  requirements: AreaRequirement[],
): ParaArea {
  return {
    ...area,
    requirements: { ...area.requirements, [health]: requirements },
    requirementsRevision: { ...area.requirementsRevision, [health]: REQUIREMENTS_REVISION },
  };
}

export function newRequirement(text: string): AreaRequirement {
  return { id: newParaId('requirement'), text: text.trim(), done: false };
}

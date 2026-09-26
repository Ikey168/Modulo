import {
  BookOpen, BriefcaseBusiness, CircleDollarSign, Compass, Dumbbell,
  GraduationCap, HeartPulse, House, Leaf, MapPinned, Palette,
  Plane, Sparkles, UsersRound, type LucideIcon,
} from 'lucide-react';
import { AREA_ICON_IDS, type AreaIconId, type ParaArea } from './para';

export const AREA_ICONS = {
  compass: { label: 'General', icon: Compass },
  health: { label: 'Health', icon: HeartPulse },
  fitness: { label: 'Fitness', icon: Dumbbell },
  career: { label: 'Career', icon: BriefcaseBusiness },
  money: { label: 'Money', icon: CircleDollarSign },
  home: { label: 'Home', icon: House },
  people: { label: 'Relationships', icon: UsersRound },
  learning: { label: 'Learning', icon: GraduationCap },
  reading: { label: 'Reading', icon: BookOpen },
  travel: { label: 'Travel', icon: Plane },
  places: { label: 'Places', icon: MapPinned },
  creative: { label: 'Creative', icon: Palette },
  nature: { label: 'Nature', icon: Leaf },
  personal: { label: 'Personal', icon: Sparkles },
} satisfies Record<AreaIconId, { label: string; icon: LucideIcon }>;

export const AREA_ICON_OPTIONS = AREA_ICON_IDS.map((value) => ({
  value,
  label: AREA_ICONS[value].label,
}));

/** Legacy areas have no icon; infer one without modifying their saved records. */
export function areaIconId(area: Pick<ParaArea, 'icon' | 'name' | 'category'>): AreaIconId {
  if (area.icon) return area.icon;
  const name = area.name.toLowerCase();
  const category = area.category.toLowerCase();
  const rules: Array<[RegExp, AreaIconId]> = [
    [/fitness|exercise|training|strength|movement|sport|gym/, 'fitness'],
    [/health|medical|wellness|sleep|nutrition|mental|therapy/, 'health'],
    [/career|work|job|business|profession|startup/, 'career'],
    [/finance|money|budget|invest|saving|wealth|tax/, 'money'],
    [/home|house|living|household|apartment/, 'home'],
    [/relationship|family|friend|social|partner|community|dating/, 'people'],
    [/education|learning|study|school|university|skill|language/, 'learning'],
    [/reading|books|literature/, 'reading'],
    [/travel|trip|vacation|holiday/, 'travel'],
    [/place|local|city|explor/, 'places'],
    [/creat|art|music|writing|design|hobb/, 'creative'],
    [/nature|outdoor|garden|environment/, 'nature'],
    [/personal|self|spiritual|reflection|growth/, 'personal'],
  ];
  return rules.find(([pattern]) => pattern.test(name))?.[1]
    ?? rules.find(([pattern]) => pattern.test(category))?.[1]
    ?? 'compass';
}

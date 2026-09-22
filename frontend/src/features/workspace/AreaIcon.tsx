import type { ParaArea } from './para';
import { AREA_ICONS, areaIconId } from './paraAreaIcons';

export function AreaIcon({ area, className = 'size-4' }: {
  area: Pick<ParaArea, 'icon' | 'name' | 'category'>;
  className?: string;
}) {
  const Icon = AREA_ICONS[areaIconId(area)].icon;
  return <Icon className={className} aria-hidden="true" />;
}

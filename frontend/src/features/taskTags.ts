export interface DeviceTagOption {
  value: string;
  label: string;
}

/** Canonical device tags shared by the task and project-workspace surfaces. */
export const DEVICE_TAG_OPTIONS: readonly DeviceTagOption[] = [
  { value: 'device:desktop', label: 'Desktop' },
  { value: 'device:laptop', label: 'Laptop' },
  { value: 'device:phone', label: 'Phone' },
  { value: 'device:pi5', label: 'Pi 5' },
  { value: 'device:netcup', label: 'Netcup' },
  { value: 'device:oracle', label: 'Oracle' },
  { value: 'device:mikrotik', label: 'MikroTik' },
  { value: 'device:openwrt', label: 'OpenWrt' },
];

const deviceLabels = new Map(DEVICE_TAG_OPTIONS.map((option) => [option.value, option.label]));

/** Parse both the current comma-separated representation and older JSON arrays. */
export function parseTaskTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return normalizeTaskTags(value);
  }

  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return [];

  if (raw.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeTaskTags(parsed);
    } catch {
      // Fall through to the comma-separated representation.
    }
  }

  return normalizeTaskTags(raw.split(','));
}

export function normalizeTaskTags(values: unknown[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    if (typeof value !== 'string') return [];
    const tag = value.trim();
    if (!tag || seen.has(tag.toLocaleLowerCase())) return [];
    seen.add(tag.toLocaleLowerCase());
    return [tag];
  });
}

export function serializeTaskTags(value: string | string[] | null | undefined): string {
  return parseTaskTags(value).join(', ');
}

export function isDeviceTag(tag: string): boolean {
  return deviceLabels.has(tag);
}

export function deviceTagLabel(tag: string): string {
  return deviceLabels.get(tag) ?? tag;
}

export function taskTagsInclude(value: string | string[] | null | undefined, tag: string): boolean {
  return parseTaskTags(value).some((candidate) => candidate.toLocaleLowerCase() === tag.toLocaleLowerCase());
}

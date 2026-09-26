import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';

export const MUSIC_STORE_KEY = 'modulo-music-studio-v1';
export const MUSIC_PROJECT_TYPES = ['Track', 'EP', 'Album', 'Live Set', 'DJ Set', 'Modular Patch'] as const;
export const MUSIC_PROJECT_STATUSES = ['Idea', 'Sketch', 'Arrangement', 'Recording', 'Mixing', 'Mastering', 'Ready', 'Released', 'Archived'] as const;
export const MUSIC_ASSET_TYPES = ['Sample', 'Preset', 'Patch', 'Gear', 'Reference', 'Repertoire', 'Setlist'] as const;
export const MUSIC_PRACTICE_STATUSES = ['Planned', 'Done', 'Skipped'] as const;

export interface MusicProject { id: string; title: string; type: typeof MUSIC_PROJECT_TYPES[number]; status: typeof MUSIC_PROJECT_STATUSES[number]; bpm?: number; musicalKey?: string; targetDate?: string; nextAction: string; definitionOfDone: string; releaseNotes: string; collaborators: string[]; }
export interface MusicPractice { id: string; date: string; instrument: string; focus: string; piece: string; minutes: number; bpm?: number; blockId?: DayBlockId; status: typeof MUSIC_PRACTICE_STATUSES[number]; notes: string; }
export interface MusicAsset { id: string; type: typeof MUSIC_ASSET_TYPES[number]; title: string; projectId?: string; path?: string; source?: string; license?: string; tags: string[]; notes: string; }
export interface MusicData { version: 1; projects: MusicProject[]; practice: MusicPractice[]; assets: MusicAsset[]; }

export const emptyMusicData = (): MusicData => ({ version: 1, projects: [], practice: [], assets: [] });
export const newMusicId = (prefix: 'project' | 'practice' | 'asset'): string => `music-${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalText = (value: unknown): string | undefined => text(value) || undefined;
const strings = (value: unknown): string[] => array(value).filter((item): item is string => typeof item === 'string' && item.length > 0);
const number = (value: unknown): number | undefined => Number.isFinite(Number(value)) ? Number(value) : undefined;
const choice = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => options.includes(value as T) ? value as T : fallback;
const blockId = (value: unknown): DayBlockId | undefined => DAY_BLOCKS.some((block) => block.id === value) ? value as DayBlockId : undefined;

export function parseMusicData(value: unknown): MusicData {
  const raw = object(value);
  return { version: 1,
    projects: array(raw.projects).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({ id: text(item.id), title: text(item.title), type: choice(item.type, MUSIC_PROJECT_TYPES, 'Track'), status: choice(item.status, MUSIC_PROJECT_STATUSES, 'Idea'), bpm: number(item.bpm), musicalKey: optionalText(item.musicalKey), targetDate: optionalText(item.targetDate), nextAction: text(item.nextAction), definitionOfDone: text(item.definitionOfDone), releaseNotes: text(item.releaseNotes), collaborators: strings(item.collaborators) })),
    practice: array(raw.practice).map(object).filter((item) => text(item.id) && text(item.date)).map((item) => ({ id: text(item.id), date: text(item.date), instrument: text(item.instrument), focus: text(item.focus), piece: text(item.piece), minutes: Math.max(0, number(item.minutes) ?? 0), bpm: number(item.bpm), blockId: blockId(item.blockId), status: choice(item.status, MUSIC_PRACTICE_STATUSES, 'Planned'), notes: text(item.notes) })),
    assets: array(raw.assets).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({ id: text(item.id), type: choice(item.type, MUSIC_ASSET_TYPES, 'Sample'), title: text(item.title), projectId: optionalText(item.projectId), path: optionalText(item.path), source: optionalText(item.source), license: optionalText(item.license), tags: strings(item.tags), notes: text(item.notes) })),
  };
}
export const musicPracticeOn = (data: MusicData, date: string): MusicPractice[] => data.practice.filter((item) => item.date === date).sort((a, b) => DAY_BLOCKS.findIndex((block) => block.id === a.blockId) - DAY_BLOCKS.findIndex((block) => block.id === b.blockId));
export const completedMusicMinutes = (data: MusicData, start: string, end: string): number => data.practice.filter((item) => item.status === 'Done' && item.date >= start && item.date <= end).reduce((sum, item) => sum + item.minutes, 0);
export const unfinishedMusicProjects = (data: MusicData): MusicProject[] => data.projects.filter((item) => !['Released', 'Archived'].includes(item.status));

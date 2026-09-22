import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';
export const HOMELAB_STORE_KEY = 'modulo-homelab-v1';
export const HOMELAB_ASSET_TYPES = ['Server', 'SBC', 'NAS', 'Router', 'Switch', 'Access Point', 'VM', 'Container', 'Service', 'Domain', 'Network', 'VLAN', 'Other'] as const;
export const HOMELAB_STATUSES = ['Planned', 'Online', 'Degraded', 'Offline', 'Retired'] as const;
export const HOMELAB_RUN_TYPES = ['Deployment', 'Change', 'Incident', 'Maintenance', 'Backup', 'Restore Test', 'Experiment'] as const;
export const HOMELAB_RUN_STATUSES = ['Planned', 'In progress', 'Done', 'Failed'] as const;
export interface HomelabAsset { id: string; name: string; type: typeof HOMELAB_ASSET_TYPES[number]; status: typeof HOMELAB_STATUSES[number]; hostId?: string; environment: string; address?: string; url?: string; criticality: 'Low' | 'Medium' | 'High'; notes: string; }
export interface HomelabRun { id: string; assetId?: string; type: typeof HOMELAB_RUN_TYPES[number]; title: string; date: string; minutes: number; blockId?: DayBlockId; status: typeof HOMELAB_RUN_STATUSES[number]; outcome: string; nextAction: string; }
export const HOMELAB_BACKUP_HEALTH_SCHEMA_ID = 'modulo.homelab.backup-health.v1';
export const HOMELAB_BACKUP_INTEGRITY = ['ok', 'degraded', 'failed', 'unknown'] as const;
export const HOMELAB_BACKUP_RESTORE_STATUSES = ['passed', 'failed', 'not-run', 'unknown'] as const;
export interface HomelabBackupRestoreTest { status: typeof HOMELAB_BACKUP_RESTORE_STATUSES[number]; observedAt?: string; evidenceRef?: string; }
export interface HomelabBackupHealth {
  assetId: string;
  owner: string;
  observedAt: string;
  lastSuccess?: string;
  ageSeconds: number;
  capacityKiB: number;
  integrity: typeof HOMELAB_BACKUP_INTEGRITY[number];
  lastRestoreTest: HomelabBackupRestoreTest;
  failureState: string;
  source?: string;
}
export interface HomelabData { version: 1; assets: HomelabAsset[]; runs: HomelabRun[]; backupHealth: HomelabBackupHealth[]; }
export const emptyHomelabData = (): HomelabData => ({ version: 1, assets: [], runs: [], backupHealth: [] });
export const newHomelabId = (prefix: 'asset' | 'run'): string => `homelab-${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const object = (v: unknown): Record<string, unknown> => typeof v === 'object' && v !== null ? v as Record<string, unknown> : {}; const array = (v: unknown): unknown[] => Array.isArray(v) ? v : []; const text = (v: unknown): string => typeof v === 'string' ? v : ''; const optionalText = (v: unknown): string | undefined => text(v) || undefined; const number = (v: unknown): number => Number.isFinite(Number(v)) ? Number(v) : 0; const choice = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => values.includes(v as T) ? v as T : fallback; const block = (v: unknown): DayBlockId | undefined => DAY_BLOCKS.some((item) => item.id === v) ? v as DayBlockId : undefined;
export function parseHomelabData(value: unknown): HomelabData {
  const raw = object(value);
  return {
    version: 1,
    assets: array(raw.assets).map(object).filter((v) => text(v.id) && text(v.name)).map((v) => ({ id: text(v.id), name: text(v.name), type: choice(v.type, HOMELAB_ASSET_TYPES, 'Other'), status: choice(v.status, HOMELAB_STATUSES, 'Planned'), hostId: optionalText(v.hostId), environment: text(v.environment), address: optionalText(v.address), url: optionalText(v.url), criticality: choice(v.criticality, ['Low', 'Medium', 'High'] as const, 'Medium'), notes: text(v.notes) })),
    runs: array(raw.runs).map(object).filter((v) => text(v.id) && text(v.title) && text(v.date)).map((v) => ({ id: text(v.id), assetId: optionalText(v.assetId), type: choice(v.type, HOMELAB_RUN_TYPES, 'Experiment'), title: text(v.title), date: text(v.date), minutes: Math.max(0, number(v.minutes)), blockId: block(v.blockId), status: choice(v.status, HOMELAB_RUN_STATUSES, 'Planned'), outcome: text(v.outcome), nextAction: text(v.nextAction) })),
    backupHealth: array(raw.backupHealth).map(object).filter((v) => text(v.assetId) && text(v.observedAt) && text(v.owner)).map((v) => {
      const restore = object(v.lastRestoreTest);
      return {
        assetId: text(v.assetId),
        owner: text(v.owner),
        observedAt: text(v.observedAt),
        lastSuccess: optionalText(v.lastSuccess),
        ageSeconds: number(v.ageSeconds),
        capacityKiB: Math.max(0, number(v.capacityKiB)),
        integrity: choice(v.integrity, HOMELAB_BACKUP_INTEGRITY, 'unknown'),
        lastRestoreTest: {
          status: choice(restore.status, HOMELAB_BACKUP_RESTORE_STATUSES, 'unknown'),
          observedAt: optionalText(restore.observedAt),
          evidenceRef: optionalText(restore.evidenceRef),
        },
        failureState: text(v.failureState) || 'unknown',
        source: optionalText(v.source),
      };
    }),
  };
}
export const homelabRunsOn = (data: HomelabData, date: string): HomelabRun[] => data.runs.filter((run) => run.date === date);

import type { PluginStateClient, StateJson } from '../../../../services/pluginStateClient';

export const LEGACY_INTAKE_KEY = 'modulo-information-intake-v1';
const COLLECTIONS = [
  'items', 'sessions', 'artifacts', 'projects', 'explorationTrails',
  'syntheses', 'cases', 'creations', 'learningPlans', 'experiments',
  'maintenanceReviews', 'transitions',
] as const;
type Collection = typeof COLLECTIONS[number];
type SourceRecord = { id: string; [field: string]: StateJson };
type MigrationRecord = {
  key: string;
  value: { collection: Collection; legacyId: string; payload: SourceRecord;
    sourceDigest: string; importedAt: string };
};
type Reader = Pick<PluginStateClient, 'get'>;
type Writer = Pick<PluginStateClient, 'get' | 'create' | 'set' | 'delete' | 'synchronize'>;

export interface LegacyIntakePlan {
  status: 'absent' | 'ready' | 'blocked';
  sourceDigest?: string;
  reportKey?: string;
  reportExists: boolean;
  counts: Record<Collection, number>;
  toCreate: number;
  alreadyPresent: number;
  blockers: string[];
  warnings: string[];
  records: MigrationRecord[];
}

const isObject = (value: unknown): value is Record<string, StateJson> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const canonical = (value: StateJson): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const digest = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const hashed = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hashed)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

/** Read the current browser's Modulo intake store without normalizing away user fields. */
export async function planLegacyIntakeMigration(raw: string | null, state: Reader,
  now = new Date().toISOString()): Promise<LegacyIntakePlan> {
  const counts = Object.fromEntries(COLLECTIONS.map(name => [name, 0])) as Record<Collection, number>;
  const plan: LegacyIntakePlan = { status: 'absent', reportExists: false, counts, toCreate: 0,
    alreadyPresent: 0, blockers: [], warnings: [], records: [] };
  if (raw === null) return plan;
  if (new TextEncoder().encode(raw).length > 20_000_000) {
    plan.blockers.push('The browser-local intake store exceeds the 20 MB migration budget.');
    plan.status = 'blocked'; return plan;
  }
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { plan.blockers.push('The browser-local intake store is not valid JSON.'); plan.status = 'blocked'; return plan; }
  if (!isObject(value) || value.version !== 1) {
    plan.blockers.push('Only Modulo Information Intake version 1 can be migrated.');
    plan.status = 'blocked'; return plan;
  }
  const unknown = Object.keys(value).filter(key => key !== 'version' && !COLLECTIONS.includes(key as Collection));
  if (unknown.length) plan.blockers.push(`Unknown top-level collections: ${unknown.join(', ')}. Preserve the local store until these are mapped.`);
  const sourceDigest = await digest(raw);
  plan.sourceDigest = sourceDigest;
  plan.reportKey = `migration.${sourceDigest.slice(0, 32)}`;
  const keys = new Set<string>();
  const urls = new Map<string, string>();
  const itemIds = new Set<string>();
  const projectIds = new Set<string>();
  for (const collection of COLLECTIONS) {
    const entries = value[collection];
    if (entries === undefined) continue;
    if (!Array.isArray(entries)) {
      plan.blockers.push(`${collection} is not a list.`); continue;
    }
    counts[collection] = entries.length;
    if (entries.length > 5000) plan.blockers.push(`${collection} exceeds 5,000 records.`);
    for (const entry of entries) {
      if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id || entry.id.length > 256) {
        plan.blockers.push(`${collection} contains a record without a usable string ID.`); continue;
      }
      const id = entry.id;
      const key = `legacy.${collection}.${(await digest(`${collection}\u0000${id}`)).slice(0, 32)}`;
      if (keys.has(key)) { plan.blockers.push(`${collection} repeats ID ${id}.`); continue; }
      keys.add(key);
      const payload = entry as SourceRecord;
      if (new TextEncoder().encode(JSON.stringify(payload)).length > 900_000) {
        plan.blockers.push(`${collection}/${id} exceeds the per-record state limit.`); continue;
      }
      if (collection === 'items') {
        itemIds.add(id);
        if (typeof entry.url === 'string' && entry.url.trim()) {
          const url = entry.url.trim().toLowerCase();
          const prior = urls.get(url);
          if (prior) plan.warnings.push(`Items ${prior} and ${id} share URL ${entry.url}; their IDs remain separate.`);
          else urls.set(url, id);
        }
      }
      if (collection === 'projects') projectIds.add(id);
      const sourceRecordDigest = await digest(canonical(payload));
      const record: MigrationRecord = { key, value: {
        collection, legacyId: id, payload, sourceDigest: sourceRecordDigest, importedAt: now,
      } };
      plan.records.push(record);
      const existing = state.get(key);
      if (!existing || existing.deleted) {
        if (existing?.conflict) plan.blockers.push(`${collection}/${id} has a plugin-state conflict.`);
        else plan.toCreate++;
      } else if (existing.conflict || !isObject(existing.value)
        || existing.value.legacyId !== id || existing.value.collection !== collection
        || existing.value.sourceDigest !== sourceRecordDigest
        || !isObject(existing.value.payload)
        || await digest(canonical(existing.value.payload)) !== sourceRecordDigest) {
        plan.blockers.push(`${collection}/${id} differs from plugin state; resolve the conflict before import.`);
      } else plan.alreadyPresent++;
    }
  }
  if (plan.records.length > 5000) plan.blockers.push('The migration exceeds 5,000 records.');
  for (const record of plan.records) {
    const itemId = record.value.payload.itemId;
    const projectId = record.value.payload.projectId;
    if (typeof itemId === 'string' && !itemIds.has(itemId))
      plan.warnings.push(`${record.value.collection}/${record.value.legacyId} references missing item ${itemId}.`);
    if (typeof projectId === 'string' && !projectIds.has(projectId))
      plan.warnings.push(`${record.value.collection}/${record.value.legacyId} references missing project ${projectId}.`);
  }
  const existingReport = state.get(plan.reportKey);
  const reportKeys = plan.records.map(record => record.key).sort();
  if (existingReport?.conflict || (existingReport && !existingReport.deleted
    && (!isObject(existingReport.value)
      || existingReport.value.sourceDigest !== sourceDigest
      || !Array.isArray(existingReport.value.recordKeys)
      || canonical(existingReport.value.recordKeys) !== canonical(reportKeys)))) {
    plan.blockers.push('The import report key has conflicting plugin state.');
  } else plan.reportExists = !!existingReport && !existingReport.deleted;
  plan.status = plan.blockers.length ? 'blocked' : 'ready';
  return plan;
}

export async function importLegacyIntake(plan: LegacyIntakePlan, client: Writer): Promise<{
  staged: number; confirmed: number; pending: number; conflicts: number;
  reportPending: boolean; reportConflict: boolean; reportKey: string;
}> {
  if (plan.status !== 'ready' || !plan.reportKey || !plan.sourceDigest)
    throw new Error('Preflight must pass before importing Modulo intake state.');
  let staged = 0;
  for (const record of plan.records) {
    const existing = client.get(record.key);
    if (existing && !existing.deleted) {
      if (existing.conflict || !isObject(existing.value)
        || existing.value.sourceDigest !== record.value.sourceDigest
        || !isObject(existing.value.payload)
        || await digest(canonical(existing.value.payload)) !== record.value.sourceDigest)
        throw new Error(`Plugin state changed for ${record.value.collection}/${record.value.legacyId}; run preflight again.`);
      continue;
    }
    if (existing?.conflict) throw new Error(`Plugin state changed for ${record.value.collection}/${record.value.legacyId}; run preflight again.`);
    if (existing) await client.set(record.key, record.value, 'modulo.intake.legacy-record', 1);
    else await client.create(record.key, record.value, 'modulo.intake.legacy-record', 1);
    staged++;
  }
  const existingReport = client.get(plan.reportKey);
  if (existingReport && !existingReport.deleted && (existingReport.conflict
    || !isObject(existingReport.value)
    || existingReport.value.sourceDigest !== plan.sourceDigest
    || !Array.isArray(existingReport.value.recordKeys)
    || canonical(existingReport.value.recordKeys)
      !== canonical(plan.records.map(record => record.key).sort())))
    throw new Error('The import report changed. Preview again before importing.');
  if (!existingReport || existingReport.deleted) {
    const value = {
      sourceKey: LEGACY_INTAKE_KEY, sourceDigest: plan.sourceDigest,
      recordKeys: plan.records.map(record => record.key).sort(),
      counts: plan.counts, importedAt: new Date().toISOString(),
    };
    if (existingReport) await client.set(plan.reportKey, value, 'modulo.intake.import-report', 1);
    else await client.create(plan.reportKey, value, 'modulo.intake.import-report', 1);
  }
  await client.synchronize();
  const views = plan.records.map(record => client.get(record.key));
  return {
    staged,
    confirmed: views.filter(view => view && !view.pending && !view.conflict && !view.deleted).length,
    pending: views.filter(view => view?.pending).length,
    conflicts: views.filter(view => view?.conflict).length,
    reportPending: !!client.get(plan.reportKey)?.pending,
    reportConflict: !!client.get(plan.reportKey)?.conflict,
    reportKey: plan.reportKey,
  };
}

/** Reverse only records still byte-equivalent in meaning to their imported source. */
export async function undoLegacyIntake(plan: LegacyIntakePlan, client: Writer): Promise<{
  pending: number; conflicts: number;
}> {
  if (plan.status !== 'ready' || !plan.reportExists || !plan.reportKey)
    throw new Error('A matching import report is required before undo.');
  const report = client.get(plan.reportKey);
  if (!report || report.deleted || report.conflict || !isObject(report.value)
    || report.value.sourceDigest !== plan.sourceDigest)
    throw new Error('The import report changed. Preview again before undo.');
  for (const record of plan.records) {
    const current = client.get(record.key);
    if (!current || current.deleted || current.conflict || !isObject(current.value)
      || !isObject(current.value.payload)
      || current.value.sourceDigest !== record.value.sourceDigest
      || await digest(canonical(current.value.payload)) !== record.value.sourceDigest)
      throw new Error(`Imported ${record.value.collection}/${record.value.legacyId} changed. Undo would lose edits.`);
  }
  for (const record of plan.records) {
    await client.delete(record.key);
  }
  await client.delete(plan.reportKey);
  await client.synchronize();
  const views = [...plan.records.map(record => client.get(record.key)), client.get(plan.reportKey)];
  return { pending: views.filter(view => view?.pending).length,
    conflicts: views.filter(view => view?.conflict).length };
}

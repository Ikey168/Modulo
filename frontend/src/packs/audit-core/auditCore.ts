export const AUDIT_CORE_PHASES = [
  { id: 'p0_scoping', label: 'Scope' },
  { id: 'p1_fingerprinting', label: 'Architecture' },
  { id: 'p2_threat_modeling', label: 'Threat model' },
  { id: 'p3_automated_triage', label: 'Automated triage' },
  { id: 'p4_manual_review', label: 'Manual review' },
  { id: 'p5_dynamic_analysis', label: 'Dynamic analysis' },
  { id: 'p6_exploit_development', label: 'Exploit development' },
  { id: 'p7_severity_triage', label: 'Severity triage' },
  { id: 'p8_reporting', label: 'Reporting' },
  { id: 'p9_remediation', label: 'Remediation' },
] as const;

export type AuditCorePhaseId = typeof AUDIT_CORE_PHASES[number]['id'];

export interface AuditCoreArtifact {
  path: string;
  value: unknown;
  size: number;
}

export interface AuditCoreParseError {
  path: string;
  message: string;
}

export interface AuditCoreBundle {
  id: string;
  name: string;
  importedAt: string;
  version: number | null;
  artifacts: Readonly<Record<string, AuditCoreArtifact>>;
  errors: readonly AuditCoreParseError[];
  skipped: readonly { path: string; size: number; reason: string }[];
}

export interface AuditCoreInputEntry {
  path: string;
  text: string;
  size?: number;
}

export interface AuditCoreFinding {
  id: string;
  title: string;
  severity: string;
  status: string;
  path: string;
  raw: Readonly<Record<string, unknown>>;
}

export interface AuditCorePhaseSummary {
  id: AuditCorePhaseId;
  label: string;
  artifacts: number;
  ran: number;
  skipped: number;
  degraded: number;
  errored: number;
}

const CHANGE_EVENT = 'modulo:audit-core-bundle-changed';
let activeBundle: AuditCoreBundle | null = null;

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;

export const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export const displayValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
};

function normalisePath(path: string): string {
  return path.split('\\').join('/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
}

function commonRoot(paths: string[]): string | null {
  const firstParts = paths.map((path) => normalisePath(path).split('/'));
  if (firstParts.length === 0 || firstParts.some((parts) => parts.length < 2)) return null;
  const first = firstParts[0][0];
  return firstParts.every((parts) => parts[0] === first) ? first : null;
}

function bundleName(entries: AuditCoreInputEntry[], root: string | null): string {
  if (root) return root;
  const ledger = entries.find((entry) => normalisePath(entry.path).endsWith('/phase-ledger.json'));
  if (ledger) return normalisePath(ledger.path).split('/').slice(-2, -1)[0] || 'audit-core-output';
  return 'audit-core-output';
}

export function parseAuditCoreEntries(entries: AuditCoreInputEntry[], importedAt = new Date().toISOString()): AuditCoreBundle {
  const jsonEntries = entries.filter((entry) => entry.path.toLowerCase().endsWith('.json'));
  const root = commonRoot(jsonEntries.map((entry) => entry.path));
  const artifacts: Record<string, AuditCoreArtifact> = {};
  const errors: AuditCoreParseError[] = [];

  for (const entry of jsonEntries) {
    const fullPath = normalisePath(entry.path);
    const path = root && fullPath.startsWith(`${root}/`) ? fullPath.slice(root.length + 1) : fullPath;
    try {
      const value: unknown = JSON.parse(entry.text);
      artifacts[path] = Object.freeze({ path, value, size: entry.size ?? entry.text.length });
    } catch (error) {
      errors.push({ path, message: error instanceof Error ? error.message : 'Invalid JSON' });
    }
  }

  const ledger = asRecord(artifacts['phase-ledger.json']?.value);
  const version = typeof ledger?.version === 'number' ? ledger.version : null;
  const name = bundleName(jsonEntries, root);
  return Object.freeze({
    id: `${name}:${importedAt}`,
    name,
    importedAt,
    version,
    artifacts: Object.freeze(artifacts),
    errors: Object.freeze(errors),
    skipped: Object.freeze([]),
  });
}

export async function loadAuditCoreFiles(files: File[]): Promise<AuditCoreBundle> {
  const jsonFiles = files.filter((file) => (file.webkitRelativePath || file.name).toLowerCase().endsWith('.json'));
  const maximumBytes = 32 * 1024 * 1024;
  const readableFiles = jsonFiles.filter((file) => file.size <= maximumBytes);
  const root = commonRoot(jsonFiles.map((file) => file.webkitRelativePath || file.name));
  const entries = await Promise.all(readableFiles.map(async (file) => ({
    path: file.webkitRelativePath || file.name,
    text: await file.text(),
    size: file.size,
  })));
  const bundle = parseAuditCoreEntries(entries);
  const skipped = jsonFiles.filter((file) => file.size > maximumBytes).map((file) => {
    const fullPath = normalisePath(file.webkitRelativePath || file.name);
    return {
      path: root && fullPath.startsWith(`${root}/`) ? fullPath.slice(root.length + 1) : fullPath,
      size: file.size,
      reason: 'Larger than the 32 MiB interactive decoding limit',
    };
  });
  return Object.freeze({ ...bundle, skipped: Object.freeze(skipped) });
}

export function setActiveAuditCoreBundle(bundle: AuditCoreBundle | null): void {
  activeBundle = bundle;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getActiveAuditCoreBundle(): AuditCoreBundle | null {
  return activeBundle;
}

export function subscribeAuditCoreBundle(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export function auditCoreArtifact(bundle: AuditCoreBundle, path: string): unknown {
  return bundle.artifacts[path]?.value;
}

export function auditCorePhaseSummaries(bundle: AuditCoreBundle): AuditCorePhaseSummary[] {
  const ledger = asRecord(auditCoreArtifact(bundle, 'phase-ledger.json'));
  const runs = asRecord(ledger?.runs);
  return AUDIT_CORE_PHASES.map((phase) => {
    const shortId = phase.id.split('_')[0];
    const statuses = Object.values(runs ?? {}).filter((value) => {
      const runPhase = asRecord(value)?.phase;
      return runPhase === shortId || runPhase === phase.id;
    }).map((value) => String(asRecord(value)?.status ?? '').toLowerCase());
    return {
      ...phase,
      artifacts: Object.keys(bundle.artifacts).filter((path) => path.startsWith(`${phase.id}/`)).length
        + bundle.skipped.filter((item) => item.path.startsWith(`${phase.id}/`)).length,
      ran: statuses.filter((status) => status === 'ran').length,
      skipped: statuses.filter((status) => status === 'skipped').length,
      degraded: statuses.filter((status) => status === 'degraded').length,
      errored: statuses.filter((status) => status === 'errored').length,
    };
  });
}

export function auditCoreHealth(bundle: AuditCoreBundle): string[] {
  const issues: string[] = [];
  if (!bundle.artifacts['phase-ledger.json']) issues.push('phase-ledger.json is missing. Views will use artifact-level fallbacks.');
  if (bundle.version !== null && bundle.version !== 1) issues.push(`Ledger version ${bundle.version} is not explicitly supported; tolerant rendering is active.`);
  if (bundle.errors.length) issues.push(`${bundle.errors.length} JSON artifact${bundle.errors.length === 1 ? '' : 's'} could not be parsed.`);
  if (bundle.skipped.length) issues.push(`${bundle.skipped.length} oversized JSON artifact${bundle.skipped.length === 1 ? ' was' : 's were'} indexed but not decoded in the interactive viewer.`);
  const summaries = auditCorePhaseSummaries(bundle);
  const degraded = summaries.reduce((sum, phase) => sum + phase.degraded, 0);
  const errored = summaries.reduce((sum, phase) => sum + phase.errored, 0);
  if (degraded) issues.push(`${degraded} audit-core run${degraded === 1 ? '' : 's'} reported degraded status.`);
  if (errored) issues.push(`${errored} audit-core run${errored === 1 ? '' : 's'} reported errored status.`);
  return issues;
}

const FINDING_PATHS = [
  'p8_reporting/report.json',
  'p7_severity_triage/triaged-findings.json',
  'p6_exploit_development/validated-findings.json',
  'p4_manual_review/findings.json',
] as const;

function findingArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  if (Array.isArray(record.findings)) return record.findings;
  return asRecord(record.findings) ? Object.values(record.findings as Record<string, unknown>) : [];
}

export function auditCoreFindings(bundle: AuditCoreBundle, preferredPath?: string): AuditCoreFinding[] {
  const path = preferredPath && bundle.artifacts[preferredPath]
    ? preferredPath
    : FINDING_PATHS.find((candidate) => bundle.artifacts[candidate]);
  if (!path) return [];
  return findingArray(bundle.artifacts[path].value).flatMap((value, index) => {
    const raw = asRecord(value);
    if (!raw) return [];
    return [{
      id: displayValue(raw.findingId ?? raw.id ?? `finding-${index + 1}`),
      title: displayValue(raw.title ?? raw.name ?? raw.description ?? `Finding ${index + 1}`),
      severity: displayValue(raw.finalSeverity ?? raw.severity ?? raw.risk ?? 'Unrated'),
      status: displayValue(raw.status ?? raw.classification ?? 'Unknown'),
      path,
      raw: Object.freeze(raw),
    }];
  });
}

export function auditCoreCounts(value: unknown, keys: string[]): Array<{ label: string; count: number }> {
  const record = asRecord(value);
  return keys.flatMap((key) => {
    const child = record?.[key];
    if (Array.isArray(child)) return [{ label: key, count: child.length }];
    const childRecord = asRecord(child);
    return childRecord ? [{ label: key, count: Object.keys(childRecord).length }] : [];
  });
}

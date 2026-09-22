import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FileJson2, FolderOpen, Search, ShieldCheck, Upload } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Input,
  Spinner,
  cn,
} from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import {
  ChoiceInline,
  EmptyPanel,
  HealthLine,
  HealthList,
  Metric,
  MetricRow,
  Panel,
  SearchInput,
  Toolbar,
  ViewShell,
} from './viewkit';
import {
  AUDIT_CORE_PHASES,
  asArray,
  asRecord,
  auditCoreArtifact,
  auditCoreCounts,
  auditCoreFindings,
  auditCoreHealth,
  auditCorePhaseSummaries,
  displayValue,
  getActiveAuditCoreBundle,
  loadAuditCoreFiles,
  setActiveAuditCoreBundle,
  subscribeAuditCoreBundle,
  type AuditCoreBundle,
  type AuditCoreFinding,
} from './auditCore';

const FINDING_STAGES = [
  ['auto', 'p3_automated_triage/phase3-synthesis.json'],
  ['manual', 'p4_manual_review/findings.json'],
  ['validated', 'p6_exploit_development/validated-findings.json'],
  ['triaged', 'p7_severity_triage/triaged-findings.json'],
  ['report', 'p8_reporting/report.json'],
] as const;

function useAuditBundle(): AuditCoreBundle | null {
  const [bundle, setBundle] = useState(getActiveAuditCoreBundle);
  useEffect(() => subscribeAuditCoreBundle(() => setBundle(getActiveAuditCoreBundle())), []);
  return bundle;
}

export function AuditCoreBrowserView({ navigateView }: WorkspaceViewProps) {
  const bundle = useAuditBundle();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    inputRef.current?.setAttribute('webkitdirectory', '');
    inputRef.current?.setAttribute('directory', '');
  }, []);
  const importFiles = async (files: File[]) => {
    setBusy(true);
    setError('');
    try {
      const next = await loadAuditCoreFiles(files);
      if (Object.keys(next.artifacts).length === 0)
        throw new Error('The selected folder contains no readable JSON artifacts.');
      setActiveAuditCoreBundle(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read the selected output.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuditCoreShell
      title="Audit Core Browser"
      subtitle="Open an audit-core output folder locally. Artifacts stay in memory and are never modified or uploaded."
    >
      {/* Styled as a drop target, so it accepts a drop. */}
      <section
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (busy) return;
          const files = Array.from(event.dataTransfer.files).filter((file) =>
            file.name.toLowerCase().endsWith('.json'),
          );
          if (files.length > 0) void importFiles(files);
          else setError('Drop the JSON artifacts from an audit-core output folder.');
        }}
        className={cn(
          'rounded-md border border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        <FolderOpen className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">Select or drop an audit-core output folder</p>
        <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">
          The folder should contain phase-ledger.json and the p0_scoping through p9_remediation directories.
          You can switch folders at any time.
        </p>
        <Input
          ref={inputRef}
          className="mx-auto mt-4 max-w-md"
          type="file"
          multiple
          accept="application/json,.json"
          aria-label="Audit-core output folder"
          disabled={busy}
          onChange={(event) => void importFiles(Array.from(event.target.files ?? []))}
        />
        {busy && (
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-4" />
            Reading JSON artifacts…
          </p>
        )}
        {error && (
          <Alert variant="destructive" className="mt-3 text-left">
            <AlertTitle>Could not read that output</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </section>
      {bundle && (
        <>
          <p className="text-xs text-muted-foreground">
            Output <span className="font-mono text-foreground">{bundle.name}</span>
          </p>
          <MetricRow className="lg:grid-cols-4">
            <Metric
              label="Ledger schema"
              value={bundle.version === null ? 'Unknown' : `v${bundle.version}`}
            />
            <Metric label="Decoded JSON" value={Object.keys(bundle.artifacts).length} />
            <Metric
              label="Oversized / indexed"
              value={bundle.skipped.length}
              tone={bundle.skipped.length > 0 ? 'warning' : 'default'}
            />
            <Metric label="Parse errors" value={bundle.errors.length} tone={bundle.errors.length > 0 ? 'warning' : 'default'} />
          </MetricRow>
          <Panel
            title="Loaded artifacts"
            actions={
              <Button size="sm" onClick={() => navigateView('audit-core-overview')}>
                Open overview
              </Button>
            }
          >
            <div className="divide-y divide-border border-y border-border">
              {AUDIT_CORE_PHASES.map((phase) => {
                const paths = [
                  ...Object.keys(bundle.artifacts),
                  ...bundle.skipped.map((item) => item.path),
                ].filter((path) => path.startsWith(`${phase.id}/`));
                return (
                  <div key={phase.id} className="flex items-center gap-2 px-2 py-2">
                    <FileJson2 className="size-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{phase.label}</span>
                    <span className="min-w-0 flex-1 truncate text-xxs text-muted-foreground">
                      {paths[0] ?? 'No artifact found'}
                    </span>
                    <span className="tabular-nums text-xs text-muted-foreground">{paths.length}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
          {bundle.errors.length > 0 && (
            <Panel title="Unreadable JSON">
              <div className="space-y-1">
                {bundle.errors.map((item) => (
                  <p key={item.path} className="text-xs text-destructive">
                    <strong>{item.path}</strong>: {item.message}
                  </p>
                ))}
              </div>
            </Panel>
          )}
          {bundle.skipped.length > 0 && (
            <Panel title="Oversized artifacts">
              <p className="mb-2 text-xs text-muted-foreground">
                These files are indexed but not decoded to keep the browser responsive.
              </p>
              <div className="space-y-1">
                {bundle.skipped.map((item) => (
                  <p key={item.path} className="text-xs">
                    <strong>{item.path}</strong> · {(item.size / 1024 / 1024).toFixed(1)} MiB
                  </p>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </AuditCoreShell>
  );
}

export function AuditCoreOverviewView(props: WorkspaceViewProps) {
  return (
    <WithBundle
      props={props}
      title="Phase overview"
      subtitle="Execution status, artifacts, properties, waivers, and compatibility signals from phase-ledger.json."
    >
      {(bundle) => {
        const ledger = asRecord(auditCoreArtifact(bundle, 'phase-ledger.json'));
        const summaries = auditCorePhaseSummaries(bundle);
        const issues = auditCoreHealth(bundle);
        return (
          <>
            <div className="divide-y divide-border border-y border-border">
              {summaries.map((phase) => (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => goToPhase(props, phase.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/20"
                >
                  <span className="min-w-0 flex-1 text-xs font-semibold">{phase.label}</span>
                  <span className="text-xxs text-muted-foreground">
                    {phase.artifacts} artifacts · {phase.ran} ran · {phase.skipped} skipped
                  </span>
                  {(phase.degraded > 0 || phase.errored > 0) && (
                    <span className="text-xxs text-warning">
                      {phase.degraded} degraded · {phase.errored} errored
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <Panel title="Ledger totals">
                <KeyCounts
                  counts={[
                    { label: 'runs', count: Object.keys(asRecord(ledger?.runs) ?? {}).length },
                    { label: 'properties', count: Object.keys(asRecord(ledger?.properties) ?? {}).length },
                    { label: 'specialists', count: Object.keys(asRecord(ledger?.specialists) ?? {}).length },
                    { label: 'waivers', count: Object.keys(asRecord(ledger?.waivers) ?? {}).length },
                  ]}
                />
              </Panel>
              <Panel title="Output health">
                {issues.length === 0 ? (
                  <HealthList><HealthLine okay>No compatibility, parse, degraded-run, or errored-run signals found.</HealthLine></HealthList>
                ) : (
                  <div className="space-y-2">
                    {issues.map((issue) => (
                      <HealthLine key={issue} okay={false}>{issue}</HealthLine>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
            <Artifact bundle={bundle} path="phase-ledger.json" />
          </>
        );
      }}
    </WithBundle>
  );
}

export function AuditCoreScopeArchitectureView(props: WorkspaceViewProps) {
  return (
    <WithBundle
      props={props}
      title="Scope & Architecture"
      subtitle="Engagement boundaries, protocol fingerprint, graphs, trust surface, and upgrade model."
    >
      {(bundle) => (
        <>
          <ArtifactSummary
            bundle={bundle}
            path="p0_scoping/scope.json"
            keys={[
              'actors',
              'assumptions',
              'chains',
              'dependencies',
              'inScope',
              'outOfScope',
              'knownIssues',
              'previousAudits',
            ]}
          />
          <ArtifactSummary
            bundle={bundle}
            path="p1_fingerprinting/fingerprint.json"
            keys={[
              'contracts',
              'entryPoints',
              'roles',
              'dependencies',
              'upgradeSurface',
              'complexityMetrics',
            ]}
          />
          <ArtifactSummary
            bundle={bundle}
            path="p1_fingerprinting/graph-analysis.json"
            keys={[
              'callGraph',
              'inheritanceGraph',
              'cfgFacts',
              'dfgFacts',
              'crossReferences',
              'taintedValueFlows',
            ]}
          />
        </>
      )}
    </WithBundle>
  );
}

export function AuditCoreThreatModelView(props: WorkspaceViewProps) {
  return (
    <WithBundle
      props={props}
      title="Threat Model & Invariants"
      subtitle="Attack paths, trust boundaries, hypotheses, flow specifications, review queues, and machine-produced invariants."
    >
      {(bundle) => {
        const invariants = asRecord(auditCoreArtifact(bundle, 'p2_threat_modeling/invariants.json'));
        return (
          <>
            <ArtifactSummary
              bundle={bundle}
              path="p2_threat_modeling/threat-model.json"
              keys={[
                'attackTrees',
                'environmentAssumptions',
                'flowSpecs',
                'hypotheses',
                'privilegeMatrix',
                'reviewQueue',
                'riskClusters',
                'traceSpecs',
                'trustBoundaries',
              ]}
            />
            <Panel title="Invariant registry">
              <MetricRow className="lg:grid-cols-5">
                {['accounting', 'authorization', 'economic', 'lifecycle', 'coverageLimitation'].map((key) => (
                  <Metric key={key} label={humanize(key)} value={asArray(invariants?.[key]).length} />
                ))}
              </MetricRow>
            </Panel>
            <Artifact bundle={bundle} path="p2_threat_modeling/invariants.json" />
          </>
        );
      }}
    </WithBundle>
  );
}

export function AuditCoreFindingsView(props: WorkspaceViewProps) {
  const bundle = useAuditBundle();
  const availableStages = bundle ? FINDING_STAGES.filter(([, path]) => bundle.artifacts[path]) : [];
  const [stage, setStage] = useState('');
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const lastStage = availableStages[availableStages.length - 1];
  const selectedPath = availableStages.find(([id]) => id === stage)?.[1] ?? lastStage?.[1];
  const findings = useMemo(
    () => (bundle ? auditCoreFindings(bundle, selectedPath) : []),
    [bundle, selectedPath],
  );
  const severities = [...new Set(findings.map((item) => item.severity))].sort();
  const filtered = findings.filter(
    (item) =>
      (severity === 'all' || item.severity === severity) &&
      `${item.id} ${item.title} ${item.status}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Guard bundle={bundle} props={props}>
      <AuditCoreShell
        title="Findings & Evidence"
        subtitle="Inspect audit-core findings at each pipeline stage. Filters are UI-only; source artifacts remain immutable."
      >
        <Toolbar>
          <ChoiceInline
            label="Finding stage"
            prefix="Stage:"
            value={stage || lastStage?.[0] || ''}
            onChange={setStage}
            placeholder="Finding stage"
            options={availableStages.map(([id]) => ({ value: id, label: humanize(id) }))}
            className="w-48"
          />
          <ChoiceInline
            label="Filter by severity"
            prefix="Severity:"
            value={severity}
            onChange={setSeverity}
            options={[{ value: 'all', label: 'All severities' }, ...severities.map((item) => ({ value: item, label: item }))]}
            className="w-44"
          />
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search id, title, or status…"
            label="Search findings"
          />
        </Toolbar>
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {findings.length} findings · source: {selectedPath ?? 'none'}
        </p>
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyPanel icon={Search} title="No findings match" description="Try another stage, severity, or search term." />
          ) : (
            filtered.map((finding) => <FindingCard key={`${finding.path}:${finding.id}`} finding={finding} />)
          )}
        </div>
        {bundle && (
          <ArtifactSummary
            bundle={bundle}
            path="p3_automated_triage/phase3-synthesis.json"
            keys={['candidates', 'findings', 'reviewQueue', 'signals', 'tools']}
          />
        )}
      </AuditCoreShell>
    </Guard>
  );
}

export function AuditCoreTestsExploitsView(props: WorkspaceViewProps) {
  return (
    <WithBundle
      props={props}
      title="Tests, Traces & Exploits"
      subtitle="Dynamic-analysis results, proof status, counterexamples, validated findings, and exploit call sequences."
    >
      {(bundle) => {
        const results = asRecord(auditCoreArtifact(bundle, 'p5_dynamic_analysis/test-results.json'));
        const runs = asArray(results?.testRuns)
          .map(asRecord)
          .filter((value): value is Record<string, unknown> => value !== null);
        const byResult = countBy(runs, 'result');
        const byTool = countBy(runs, 'tool');
        return (
          <>
            <Panel title="Dynamic analysis">
              <div className="grid gap-3 lg:grid-cols-2">
                <KeyCounts counts={Object.entries(byResult).map(([label, count]) => ({ label, count }))} />
                <KeyCounts counts={Object.entries(byTool).map(([label, count]) => ({ label, count }))} />
              </div>
            </Panel>
            <ArtifactSummary
              bundle={bundle}
              path="p5_dynamic_analysis/test-results.json"
              keys={[
                'testRuns',
                'violations',
                'provenProperties',
                'forkSummary',
                'mutationSummary',
                'coverage',
              ]}
            />
            <ArtifactSummary
              bundle={bundle}
              path="p6_exploit_development/validated-findings.json"
              keys={['findings', 'validatedFindings', 'exploits', 'proofs']}
            />
          </>
        );
      }}
    </WithBundle>
  );
}

export function AuditCoreReportView(props: WorkspaceViewProps) {
  return (
    <WithBundle
      props={props}
      title="Severity & Report"
      subtitle="Final severities, executive summary, coverage limitations, traceability, provenance, and report findings."
    >
      {(bundle) => {
        const report = asRecord(auditCoreArtifact(bundle, 'p8_reporting/report.json'));
        const findings = auditCoreFindings(bundle, 'p8_reporting/report.json');
        return (
          <>
            <MetricRow className="lg:grid-cols-4">
              {Object.entries(
                countBy(
                  findings.map((finding) => finding.raw),
                  'finalSeverity',
                  'severity',
                ),
              ).map(([label, count]) => (
                <Metric key={label} label={label} value={count} />
              ))}
            </MetricRow>
            <Panel title="Executive summary">
              <TextValue
                value={report?.executiveSummary ?? report?.summary}
                empty="No executive summary in report.json."
              />
            </Panel>
            <ArtifactSummary
              bundle={bundle}
              path="p7_severity_triage/triaged-findings.json"
              keys={['findings', 'severityCounts', 'regrades', 'reviewNotes']}
            />
            <ArtifactSummary
              bundle={bundle}
              path="p8_reporting/report.json"
              keys={['findings', 'coverageLimitations', 'traceability', 'provenance', 'appendices']}
            />
          </>
        );
      }}
    </WithBundle>
  );
}

export function AuditCoreRemediationView(props: WorkspaceViewProps) {
  return (
    <WithBundle
      props={props}
      title="Remediation Comparison"
      subtitle="Fix-review and remediation artifacts produced by audit-core, shown alongside their raw evidence."
    >
      {(bundle) => {
        const paths = Object.keys(bundle.artifacts).filter((path) => path.startsWith('p9_remediation/'));
        return (
          <>
            {paths.length === 0 ? (
              <EmptyPanel icon={FileJson2} title="No remediation artifacts" description="This output produced nothing in the remediation phase." />
            ) : (
              <div className="space-y-3">
                {paths.map((path) => (
                  <ArtifactSummary
                    key={path}
                    bundle={bundle}
                    path={path}
                    keys={[
                      'findings',
                      'remediations',
                      'fixes',
                      'comparisons',
                      'resolved',
                      'unresolved',
                      'regressions',
                    ]}
                  />
                ))}
              </div>
            )}
          </>
        );
      }}
    </WithBundle>
  );
}

function WithBundle({
  props,
  title,
  subtitle,
  children,
}: {
  props: WorkspaceViewProps;
  title: string;
  subtitle: string;
  children: (bundle: AuditCoreBundle) => ReactNode;
}) {
  const bundle = useAuditBundle();
  return (
    <Guard bundle={bundle} props={props}>
      <AuditCoreShell title={title} subtitle={subtitle}>
        {bundle ? children(bundle) : null}
      </AuditCoreShell>
    </Guard>
  );
}

function Guard({
  bundle,
  props,
  children,
}: {
  bundle: AuditCoreBundle | null;
  props: WorkspaceViewProps;
  children: ReactNode;
}) {
  if (bundle) return children;
  return (
    <div className="flex flex-1 items-start p-4">
      <div className="flex w-full max-w-2xl items-center gap-3 border-y border-dashed border-border px-3 py-4">
        <Upload className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">No audit-core output loaded</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select an output folder once; every Audit Core Viewer tab will use that immutable in-memory
            bundle.
          </p>
        </div>
        <Button size="sm" onClick={() => props.navigateView('audit-core-browser')}>
          Open browser
        </Button>
      </div>
    </div>
  );
}

/** Every Audit Core tab is a read-only view over one in-memory bundle. */
function AuditCoreShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <ViewShell
      title={title}
      icon={ShieldCheck}
      subtitle={subtitle}
      actions={<Badge variant="outline">read only</Badge>}
      bodyClassName="space-y-4 p-4"
    >
      {children}
    </ViewShell>
  );
}
function KeyCounts({ counts }: { counts: Array<{ label: string; count: number }> }) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {counts.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">No countable collections found.</p>
      ) : (
        counts.map(({ label, count }) => (
          <div key={label} className="flex items-center px-2 py-1.5 text-xs">
            <span>{humanize(label)}</span>
            <strong className="ml-auto tabular-nums">{count}</strong>
          </div>
        ))
      )}
    </div>
  );
}
function ArtifactSummary({ bundle, path, keys }: { bundle: AuditCoreBundle; path: string; keys: string[] }) {
  const value = auditCoreArtifact(bundle, path);
  if (value === undefined)
    return (
      <Panel title={path}>
        <p className="text-xs text-muted-foreground">Artifact not present in this output.</p>
      </Panel>
    );
  return (
    <Panel title={path}>
      <KeyCounts counts={auditCoreCounts(value, keys)} />
      <Artifact bundle={bundle} path={path} />
    </Panel>
  );
}
function Artifact({ bundle, path }: { bundle: AuditCoreBundle; path: string }) {
  const value = auditCoreArtifact(bundle, path);
  if (value === undefined) return null;
  return (
    <details className="mt-3 rounded border border-border">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium">Raw JSON</summary>
      <pre className="max-h-[32rem] overflow-auto border-t border-border bg-muted/20 p-3 text-xxs leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
function FindingCard({ finding }: { finding: AuditCoreFinding }) {
  const description = displayValue(
    finding.raw.description ?? finding.raw.impact ?? finding.raw.justification,
  );
  return (
    <details className="rounded-md border border-border">
      <summary className="cursor-pointer list-none p-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{finding.severity}</Badge>
          <span className="text-xs font-mono">{finding.id}</span>
          <strong className="min-w-0 flex-1 truncate text-sm">{finding.title}</strong>
          <Badge variant="outline">{finding.status}</Badge>
        </div>
        {description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{description}</p>}
      </summary>
      <pre className="max-h-96 overflow-auto border-t border-border bg-muted/20 p-3 text-xxs">
        {JSON.stringify(finding.raw, null, 2)}
      </pre>
    </details>
  );
}
function TextValue({ value, empty }: { value: unknown; empty: string }) {
  if (value === undefined || value === null || value === '')
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  if (typeof value === 'string')
    return <p className="whitespace-pre-wrap text-xs leading-relaxed">{value}</p>;
  return <pre className="max-h-80 overflow-auto text-xxs">{JSON.stringify(value, null, 2)}</pre>;
}
function humanize(value: string) {
  return value
    .split('_')
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter: string) => letter.toUpperCase());
}
function countBy(items: Array<Record<string, unknown>>, ...keys: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keys.map((candidate) => displayValue(item[candidate])).find(Boolean) || 'Unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
function goToPhase(props: WorkspaceViewProps, phase: string) {
  if (phase === 'p0_scoping' || phase === 'p1_fingerprinting') props.navigateView('audit-core-scope');
  else if (phase === 'p2_threat_modeling') props.navigateView('audit-core-threats');
  else if (['p3_automated_triage', 'p4_manual_review'].includes(phase))
    props.navigateView('audit-core-findings');
  else if (['p5_dynamic_analysis', 'p6_exploit_development'].includes(phase))
    props.navigateView('audit-core-tests');
  else if (['p7_severity_triage', 'p8_reporting'].includes(phase)) props.navigateView('audit-core-report');
  else props.navigateView('audit-core-remediation');
}

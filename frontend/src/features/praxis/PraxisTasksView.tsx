import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleDashed, CircleSlash, RefreshCw, ShieldAlert, ShieldCheck, ShieldQuestion, Workflow } from 'lucide-react';
import { Alert, AlertDescription, Badge, Button, Checkbox, EmptyState, Label, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, Textarea } from '@/ui';
import { randomId } from '../../lib/randomId';
import {
  followEvents, praxisApi, PraxisError, type Approval, type ControlOperation, type PraxisEvent, type PraxisStatus,
  type ProcessView, type Submission,
} from './praxisApi';
import { controlHint } from './controlHint';

const CONTROL_LABELS: Record<Exclude<ControlOperation, 'signal'>, string> = {
  cancel: 'Cancel', suspend: 'Suspend', resume: 'Resume', retry: 'Retry',
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

/** Executor outcome and verification, shown side by side and never merged into one status. */
export function OutcomePanels({ view }: { view: ProcessView }) {
  const { summary } = view;
  const executionLabel = !summary.finished
    ? `Running (${summary.state})`
    : summary.execution.status === 'completed' ? 'Executor finished' : `Executor ${summary.execution.status ?? summary.state}`;
  const verification = summary.verification;
  const verificationLabel = !summary.finished ? 'Not verified yet'
    : !verification.available ? 'No verification report'
      : verification.approved ? 'Verified and approved' : 'Not approved by verification';
  const VerificationIcon = !summary.finished || !verification.available ? ShieldQuestion
    : verification.approved ? ShieldCheck : ShieldAlert;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <section aria-label="Execution" className="rounded-lg border border-border p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Execution</p>
        <p className="mt-1 flex items-center gap-2 font-medium">
          {summary.finished ? <CheckCircle2 aria-hidden className="size-4" /> : <CircleDashed aria-hidden className="size-4" />}
          {executionLabel}
        </p>
        {summary.execution.reason && <p className="mt-1 text-sm text-muted-foreground">Reason: {summary.execution.reason}</p>}
        {view.blocking_reason && <p className="mt-1 text-sm text-muted-foreground">Waiting on: {view.blocking_reason}</p>}
      </section>
      <section aria-label="Verification" className="rounded-lg border border-border p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Verification</p>
        <p className="mt-1 flex items-center gap-2 font-medium"><VerificationIcon aria-hidden className="size-4" />{verificationLabel}</p>
        {verification.available && !verification.approved && (
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
            {verification.requiredFailures.map(failure => <li key={`f-${failure}`}>Failed check: {failure}</li>)}
            {verification.missingOutputs.map(output => <li key={`m-${output}`}>Missing output: {output}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

function ApprovalCard({ approval, onDecide }: { approval: Approval; onDecide: (approved: boolean, reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = async (approved: boolean) => {
    setBusy(true);
    try { await onDecide(approved, reason.trim()); } finally { setBusy(false); }
  };
  return (
    <li className="rounded-lg border border-border p-3">
      <p className="font-medium">{approval.kind.replace(/_/g, ' ')} → {approval.target}</p>
      <p className="text-sm text-muted-foreground">{approval.reversible ? 'Reversible' : 'Not reversible'} · version {approval.version}</p>
      <Label htmlFor={`reason-${approval.effect_id}`} className="mt-2 block">Reason for your decision</Label>
      <Textarea id={`reason-${approval.effect_id}`} value={reason} onChange={event => setReason(event.target.value)} rows={2} />
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={busy || !reason.trim()} onClick={() => void decide(true)}>Approve</Button>
        <Button size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => void decide(false)}>Reject</Button>
      </div>
    </li>
  );
}

function TaskDetail({ processId, publishRequested, onChanged }: { processId: string; publishRequested: boolean; onChanged: () => void }) {
  const [view, setView] = useState<ProcessView | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [events, setEvents] = useState<PraxisEvent[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cursor = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const [next, pending] = await Promise.all([praxisApi.inspect(processId), praxisApi.approvals(processId).catch(() => [])]);
      setView(next);
      setApprovals(pending);
      setError(null);
    } catch (reason) {
      setError(message(reason));
    }
  }, [processId]);

  useEffect(() => {
    cursor.current = 0;
    setEvents([]);
    setView(null);
    setNotice(null);
    void refresh();
    const abort = new AbortController();
    void followEvents(processId, {
      after: 0,
      signal: abort.signal,
      onEvent: event => {
        cursor.current = event.cursor;
        setEvents(current => [...current.slice(-199), event]);
        if (/^(process\.|effect\.|verification)/.test(event.event.type)) void refresh();
      },
      onReconnect: () => setNotice('Live progress was interrupted; reconnecting from the last event.'),
    }).then(() => { if (!abort.signal.aborted) { setNotice(null); void refresh(); onChanged(); } })
      .catch(reason => { if (!abort.signal.aborted) setError(message(reason)); });
    return () => abort.abort();
  }, [processId, refresh, onChanged]);

  const act = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await work();
      if (done) setNotice(done);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  if (!view) return error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : <p>Loading task…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{view.spec.objective}</h2>
          <p className="text-sm text-muted-foreground">
            <Badge variant="outline">{view.summary.executor}</Badge> <span className="ml-1 font-mono text-xs">{view.process_id}</span>
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void refresh()} aria-label="Refresh task"><RefreshCw aria-hidden className="size-4" /></Button>
      </div>

      <OutcomePanels view={view} />

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert><AlertDescription>{notice}</AlertDescription></Alert>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Task controls">
        {(Object.keys(CONTROL_LABELS) as Array<keyof typeof CONTROL_LABELS>).map(operation => {
          const hint = controlHint(view, operation);
          return (
            <Button key={operation} size="sm" variant="outline" disabled={busy || !view.controls[operation]?.available}
              title={hint} aria-description={hint}
              onClick={() => void act(() => praxisApi.control(view.process_id, operation, view.attempt_id), `${CONTROL_LABELS[operation]} requested.`)}>
              {CONTROL_LABELS[operation]}
            </Button>
          );
        })}
        <Button size="sm" disabled={busy || !view.summary.publishable}
          title={view.summary.publishable ? undefined : 'Only a completed task whose verification approved it can be published.'}
          onClick={() => void act(async () => {
            const result = await praxisApi.publish(view.process_id);
            setNotice(result.publication.status === 'duplicate' ? 'Already published to the knowledge base.' : 'Published to the knowledge base.');
          })}>
          Publish to knowledge base
        </Button>
      </div>
      {publishRequested && !view.summary.finished && (
        <p className="text-sm text-muted-foreground">This task will be published automatically if it finishes verified.</p>
      )}

      <section aria-labelledby="praxis-approvals">
        <h3 id="praxis-approvals" className="font-medium">Approvals</h3>
        {approvals.length === 0 ? <p className="text-sm text-muted-foreground">Nothing is waiting for your approval.</p> : (
          <ul className="mt-2 space-y-2">
            {approvals.map(approval => (
              <ApprovalCard key={`${approval.effect_id}-${approval.version}`} approval={approval}
                onDecide={(approved, reason) => act(() => praxisApi.decide(view.process_id, approval, approved, reason),
                  approved ? 'Approved.' : 'Rejected.')} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="praxis-events">
        <h3 id="praxis-events" className="font-medium">Progress</h3>
        <ol className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm" aria-live="polite">
          {events.map(({ cursor: position, event }) => (
            <li key={position} className="flex gap-2">
              <span className="font-mono text-xs text-muted-foreground">{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : `#${position}`}</span>
              <span>{event.type}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function PraxisTasksView() {
  const [status, setStatus] = useState<PraxisStatus | null>(null);
  const [tasks, setTasks] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [objective, setObjective] = useState('');
  const [executor, setExecutor] = useState('');
  const [publish, setPublish] = useState(false);
  const [formKey, setFormKey] = useState(() => `modulo-${randomId(16)}`);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await praxisApi.status();
      setStatus(next);
      if (next.configured) setTasks(await praxisApi.list());
    } catch (reason) {
      setError(message(reason));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const executors = useMemo(() => Object.keys(status?.executors ?? {}), [status]);
  useEffect(() => { if (!executor && executors.length) setExecutor(executors[0]); }, [executor, executors]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const receipt = await praxisApi.submit({ objective: objective.trim(), executor, publish }, formKey);
      setObjective('');
      setPublish(false);
      setFormKey(`modulo-${randomId(16)}`); // the next task gets a new key; a retry of this one keeps it
      setSelected(receipt.process_id);
      await load();
    } catch (reason) {
      setError(reason instanceof PraxisError ? reason.message : message(reason));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTask = tasks.find(task => task.processId === selected);
  const onChanged = useCallback(() => { void load(); }, [load]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4" data-view-root="praxis-tasks">
      <header>
        <h1 className="text-xl font-semibold">Praxis Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Run tasks on the Praxis control plane. A task reports what its executor did and, separately, whether its result was verified.
        </p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {error}
            {!status && <Button variant="outline" size="sm" onClick={() => { setError(null); void load(); }}>Try again</Button>}
          </AlertDescription>
        </Alert>
      )}
      {status && !status.configured && (
        <EmptyState icon={<CircleSlash aria-hidden className="size-6" />} title="Praxis is not connected"
          description="This Modulo server has no Praxis host configured. An administrator can enable it with the settings in docs/integrations/praxis.md."
          action={<Button variant="outline" size="sm" onClick={() => void load()}>Check again</Button>} />
      )}

      {status?.configured && (
        <>
          <form className="space-y-3 rounded-lg border border-border p-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <div>
              <Label htmlFor="praxis-objective">Task</Label>
              <Textarea id="praxis-objective" value={objective} maxLength={2000} rows={3}
                placeholder="Describe what the task should achieve" onChange={event => setObjective(event.target.value)} />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label htmlFor="praxis-executor">Executor</Label>
                <Select value={executor} onValueChange={setExecutor}>
                  <SelectTrigger id="praxis-executor" className="w-48"><SelectValue placeholder="Choose an executor" /></SelectTrigger>
                  <SelectContent>{executors.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={publish} onCheckedChange={value => setPublish(value === true)} />
                Publish the verified result to the knowledge base when it finishes
              </label>
              <Button type="submit" disabled={submitting || !objective.trim() || !executor}>
                <Workflow aria-hidden className="size-4" /> Start task
              </Button>
            </div>
          </form>

          <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
            <nav aria-label="Praxis tasks" className="space-y-1">
              {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
              {tasks.map(task => (
                <button key={task.processId} type="button" onClick={() => setSelected(task.processId)}
                  aria-current={task.processId === selected ? 'true' : undefined}
                  className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted aria-[current=true]:bg-muted">
                  <span className="line-clamp-2 font-medium">{task.objective}</span>
                  <span className="text-xs text-muted-foreground">
                    {task.executor}{task.createdAt ? ` · ${new Date(task.createdAt).toLocaleString()}` : ''}
                  </span>
                </button>
              ))}
            </nav>
            <div className="min-w-0">
              {selected ? <TaskDetail processId={selected} publishRequested={selectedTask?.publishRequested ?? false} onChanged={onChanged} />
                : <p className="text-sm text-muted-foreground">Select a task to see its progress.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

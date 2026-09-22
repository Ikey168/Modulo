import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Play, Sparkles } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
  Textarea,
  cn,
} from '@/ui';
import {
  Choice,
  EmptyPanel,
  Field,
  ListRow,
  ListRows,
  Panel,
  SearchInput,
  Toolbar,
  ViewShell,
  useDeepLink,
} from './viewkit';
import { DAY_BLOCKS } from './dayBlocks';
import {
  INTAKE_MODES,
  INTAKE_MODE_DEFINITIONS,
  artifactTemplate,
  defaultArtifactType,
  newInformationIntakeId,
  transitionResearch,
  type IntakeItem,
  type IntakeMode,
} from './informationIntake';
import { isoDay } from './para';
import { useInformationIntakeStore } from './useInformationIntakeStore';
import type { WorkspaceViewProps } from './plugins/types';
import { EntryPopover, EntryPopoverBody } from './EntryPopover';

const MODE_STEPS: Record<IntakeMode, string[]> = {
  Awareness: [
    'Scan only the trusted inputs',
    'Touch and decide every item',
    'Discard most; escalate only meaningful signals',
  ],
  Exploration: [
    'Set a hard stop before opening links',
    'Follow curiosity without inventing a deliverable',
    'Capture only surprising connections or an escalation',
  ],
  'Deep Research': [
    'Bound the topic and definition of done',
    'Collect sources and extract citeable evidence',
    'Build concepts and a claim ledger',
    'Produce a brief, mental model, and maps',
    'State what is known, uncertain, and unresolved',
  ],
  'Decision Support': [
    'Name the decision and constraints',
    'Define criteria before comparing options',
    'Gather only decision-changing evidence',
    'Record the choice, rationale, risks, and revisit triggers',
  ],
  'Problem-Solving': [
    'Reproduce and bound the blocker',
    'Search, test, and iterate toward working state',
    'Verify the fix',
    'Capture a reusable solution only if recurrence is likely',
  ],
  Creation: [
    'Define the artifact and audience',
    'Build from the strongest available knowledge',
    'Iterate toward the acceptance criteria',
    'Ship the finished artifact',
  ],
  Externalization: [
    'Choose a trusted destination',
    'Encode the exact procedure or default',
    'Test it without relying on memory',
    'Make it findable months from now',
  ],
  Internalization: [
    'Define the capability to recall or perform',
    'Create retrieval or deliberate-practice prompts',
    'Practice under realistic conditions',
    'Teach or execute without notes',
  ],
  Iteration: [
    'Apply the current artifact',
    'Record the observed result',
    'Locate the model or procedure gap',
    'Change the source artifact and test again',
  ],
  Maintenance: [
    'Review stale and due artifacts',
    'Update what is still valuable',
    'Archive or delete cruft',
    'Finish the health checklist within the timebox',
  ],
};

export function InformationWorkbenchView({ navigateView }: WorkspaceViewProps) {
  const [data, persist] = useInformationIntakeStore();
  const candidates = data.items.filter((item) => item.mode && ['Planned', 'Active'].includes(item.status));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useDeepLink('item', setSelectedId);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter((item) =>
      `${item.title} ${item.mode ?? ''} ${item.status} ${item.reason ?? ''}`.toLowerCase().includes(needle),
    );
  }, [candidates, query]);
  const selected = data.items.find((item) => item.id === selectedId) ?? null;
  const [outcome, setOutcome] = useState('');
  const definition = INTAKE_MODE_DEFINITIONS.find((item) => item.mode === selected?.mode);
  const patch = (update: Partial<IntakeItem>) =>
    selected &&
    persist((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selected.id ? { ...item, ...update, lastTouchedAt: new Date().toISOString() } : item,
      ),
    }));

  const logSession = (done: boolean) => {
    if (!selected?.mode) return;
    const date = selected.scheduledDate ?? isoDay();
    persist((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              status: 'Active',
              outputSummary: outcome.trim() || item.outputSummary,
              lastTouchedAt: new Date().toISOString(),
            }
          : item,
      ),
      sessions: [
        ...current.sessions,
        {
          id: newInformationIntakeId('session'),
          itemId: selected.id,
          mode: selected.mode!,
          date,
          durationMinutes: selected.durationMinutes ?? definition?.defaultMinutes ?? 30,
          blockId: selected.blockId,
          status: done ? 'Done' : 'Planned',
          outcome: outcome.trim() || undefined,
        },
      ],
    }));
    setOutcome('');
  };
  const createOutput = () => {
    if (!selected?.mode) return;
    const now = new Date().toISOString();
    const type = defaultArtifactType(selected.mode);
    persist((current) => ({
      ...current,
      artifacts: [
        {
          id: newInformationIntakeId('artifact'),
          itemId: selected.id,
          mode: selected.mode!,
          type,
          title: selected.title,
          body: outcome.trim() || selected.outputSummary || artifactTemplate(type),
          status: 'Draft',
          projectId: selected.projectId,
          areaId: selected.areaId,
          sourceUrls: selected.url ? [selected.url] : [],
          createdAt: now,
          updatedAt: now,
        },
        ...current.artifacts,
      ],
    }));
    navigateView('information-outputs');
  };
  const completeMode = () => {
    if (!selected?.mode) return;
    persist((current) => {
      if (!selected.nextMode)
        return {
          ...current,
          items: current.items.map((item) =>
            item.id === selected.id
              ? {
                  ...item,
                  status: 'Done',
                  outputSummary: outcome.trim() || item.outputSummary,
                  lastTouchedAt: new Date().toISOString(),
                }
              : item,
          ),
        };
      const transitioned = transitionResearch(
        current,
        { itemId: selected.id },
        selected.nextMode,
        outcome.trim() || `Completed ${selected.mode}`,
      );
      return {
        ...transitioned,
        items: transitioned.items.map((item) =>
          item.id === selected.id
            ? { ...item, status: 'Planned', outputSummary: outcome.trim() || item.outputSummary }
            : item,
        ),
      };
    });
    setOutcome('');
  };

  if (candidates.length === 0)
    return (
      <ViewShell
        title="Mode workbench"
        icon={Sparkles}
        subtitle="The queue of routed items, and the mode each one is running."
      >
        <EmptyPanel
          icon={Sparkles}
          size="page"
          title="No active mode"
          description="Route an intake item, then plan or activate it."
          action={
            <Button size="sm" onClick={() => navigateView('information-intake')}>
              Open intake
            </Button>
          }
        />
      </ViewShell>
    );

  return (
    <>
      <ViewShell
        title="Mode workbench"
        icon={Sparkles}
        subtitle="The queue of routed items, and the mode each one is running."
        toolbar={
          <Toolbar>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search the queue…"
              label="Search the workbench queue"
            />
          </Toolbar>
        }
      >
        <Panel title={`${visible.length} in the queue`} icon={Clock3} bodyClassName="p-0">
          {visible.length === 0 ? (
            <EmptyPanel icon={Sparkles} title="Nothing matches" description="Try another search term." />
          ) : (
            <ListRows>
              {visible.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.title}
                  meta={`${item.mode} · ${item.status}`}
                  onOpen={() => setSelectedId(item.id)}
                  className={cn(selected?.id === item.id && 'bg-primary/10')}
                />
              ))}
            </ListRows>
          )}
        </Panel>
      </ViewShell>
      <EntryPopover
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={selected?.title ?? 'Workbench item'}
        description={selected ? `${selected.mode} · ${selected.status}` : undefined}
      >
        {selected && definition && (
          <EntryPopoverBody>
            <div className="mx-auto flex max-w-4xl flex-col gap-4 p-5">
              <header className="border-b border-border pb-3">
                <h2 className="text-base font-semibold">{selected.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.mode}
                  {selected.reason ? ` · ${selected.reason}` : ''}
                </p>
              </header>
              <section className="grid gap-x-4 border-y border-border sm:grid-cols-2">
                <div className="border-b border-border py-2">
                  <p className="text-xs text-muted-foreground">Guiding question</p>
                  <p className="text-sm">{definition.question}</p>
                </div>
                <div className="border-b border-border py-2">
                  <p className="text-xs text-muted-foreground">Done when</p>
                  <p className="text-sm">{definition.doneWhen}</p>
                </div>
                <div className="border-b border-border py-2">
                  <p className="text-xs text-muted-foreground">Expected output</p>
                  <p className="text-sm">{definition.output}</p>
                </div>
                <div className="border-b border-border py-2">
                  <p className="text-xs text-muted-foreground">Quality test</p>
                  <p className="text-sm">{definition.success}</p>
                </div>
              </section>
              <section className="rounded-sm border border-border">
                <header className="border-b border-border px-3 py-2">
                  <p className="text-sm font-medium">Mode steps</p>
                  <p className="text-xs text-muted-foreground">
                    The shape of this mode. Record what actually happened in the outcome below.
                  </p>
                </header>
                <ol className="divide-y divide-border">
                  {MODE_STEPS[selected.mode!].map((step, index) => (
                    <li key={step} className="flex gap-3 px-3 py-2 text-sm">
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {index + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
              {selected.mode === 'Deep Research' && (
                <section className="rounded-sm border border-border p-4">
                  <p className="text-sm font-medium">Deep Research escalation</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use Sources → Evidence Cards → Concepts and Claim Ledger → L1 Brief and Mental Model →
                    Concept and Evidence Maps. Keep no more than three topics active.
                  </p>
                </section>
              )}
              <section className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-3">
                <Field label="Date">
                  <Input
                    type="date"
                    value={selected.scheduledDate ?? isoDay()}
                    onChange={(event) => patch({ scheduledDate: event.target.value })}
                    className="h-9"
                  />
                </Field>
                <Field label="Minutes">
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    value={selected.durationMinutes ?? definition.defaultMinutes ?? 30}
                    onChange={(event) => patch({ durationMinutes: Number(event.target.value) })}
                    className="h-9"
                  />
                </Field>
                <Choice
                  label="Day block"
                  value={selected.blockId ?? ''}
                  clearable
                  clearLabel="No block"
                  options={DAY_BLOCKS.map((block) => ({ value: block.id, label: block.label }))}
                  onChange={(blockId) =>
                    patch({ blockId: (blockId || undefined) as IntakeItem['blockId'] })
                  }
                />
              </section>
              <Field label="Session outcome or working notes">
                <Textarea
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                  rows={7}
                  placeholder="What changed? What did you learn, decide, fix, ship, encode, practice, or prune?"
                />
              </Field>
              <Choice
                label="Transition after this mode"
                value={selected.nextMode ?? ''}
                clearable
                clearLabel="No transition selected"
                hint="Chosen up front, so completing the mode moves the item somewhere deliberate."
                options={INTAKE_MODES.filter((mode) => mode !== selected.mode)}
                onChange={(nextMode) => patch({ nextMode: (nextMode || undefined) as IntakeMode })}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => logSession(false)}>
                  <Clock3 className="size-4" />
                  Plan session
                </Button>
                <Button size="sm" onClick={() => logSession(true)}>
                  <Play className="size-4" />
                  Log completed session
                </Button>
                <Button size="sm" variant="ghost" onClick={createOutput}>
                  Create output
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      {selected.nextMode ? `Complete → ${selected.nextMode}` : 'Complete mode'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Complete {selected.mode}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {selected.nextMode
                          ? `“${selected.title}” moves to ${selected.nextMode} and is re-planned there.`
                          : `“${selected.title}” is marked done and leaves the workbench queue.`}{' '}
                        Your outcome notes are saved with it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={completeMode}>
                        {selected.nextMode ? 'Move on' : 'Complete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </EntryPopoverBody>
        )}
      </EntryPopover>
    </>
  );
}

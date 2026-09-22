import { useMemo, useState } from 'react';
import { ArrowRight, Compass, Inbox, Plus } from 'lucide-react';
import { Badge, Button, Input, Textarea, cn } from '@/ui';
import { DAY_BLOCKS } from './dayBlocks';
import {
  INTAKE_MODES,
  INTAKE_MODE_DEFINITIONS,
  INTAKE_STATUSES,
  SIGNAL_DECISIONS,
  SOURCE_TIERS,
  activeDeepResearchCount,
  canActivateItem,
  newInformationIntakeId,
  removeIntakeItem,
  transitionResearch,
  type InformationIntakeData,
  type IntakeItem,
  type IntakeMode,
} from './informationIntake';
import { CardGrid, Choice, ConfirmDelete, EmptyPanel, Fact, FactGrid, Field, FieldGroup, FilterChips, LinkOut, Panel, RecordCard, RecordSheet, SearchInput, StatusBadge, Toolbar, ViewShell, useDeepLink } from './viewkit';
import { isoDay } from './para';
import type { ParaData } from './para';
import { useInformationIntakeStore } from './useInformationIntakeStore';
import { useParaStore } from './useParaStore';
import { PopoverEditor } from './EntryPopover';

const INTAKE_TONE: Record<string, 'success' | 'warning' | 'info' | 'outline'> = {
  inbox: 'warning',
  planned: 'info',
  active: 'info',
  done: 'success',
  discarded: 'outline',
};

const split = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

/**
 * `removeIntakeItem` deletes every session logged against the item and strips
 * the back-reference from any output produced from it.
 */
function cascade(data: InformationIntakeData, id: string): string {
  const sessions = data.sessions.filter((session) => session.itemId === id).length;
  const artifacts = data.artifacts.filter((artifact) => artifact.itemId === id).length;
  return `Its ${sessions} logged session${sessions === 1 ? '' : 's'} ${
    sessions === 1 ? 'is' : 'are'
  } deleted, and ${artifacts} output${artifacts === 1 ? '' : 's'} produced from it ${
    artifacts === 1 ? 'keeps its content but loses' : 'keep their content but lose'
  } the link back to this item.`;
}

/** Why the Active status is unavailable, said where the control is. */
function activationHint(data: InformationIntakeData, item: IntakeItem): string | undefined {
  if (!item.mode) return 'Route this item to a mode before it can be activated.';
  if (!canActivateItem(data, item))
    return 'Three Deep Research topics are already active. Finish or pause one before activating another.';
  return undefined;
}

/** Intake fields shared by the capture form and the edit sheet. */
function IntakeFields({
  draft,
  setDraft,
  para,
  data,
}: {
  draft: IntakeItem;
  setDraft: (next: IntakeItem) => void;
  para: ParaData;
  data: InformationIntakeData;
}) {
  const blocked = activationHint(data, draft);
  return (
    <>
      <FieldGroup legend="Capture" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Field label="Source URL">
          <Input
            type="url"
            placeholder="https://…"
            value={draft.url ?? ''}
            onChange={(event) => setDraft({ ...draft, url: event.target.value || undefined })}
          />
        </Field>
        <Field label="Why save it?">
          <Input
            value={draft.reason ?? ''}
            onChange={(event) => setDraft({ ...draft, reason: event.target.value || undefined })}
          />
        </Field>
        <Field label="Tags" hint="Comma separated." className="sm:col-span-2">
          <Input value={draft.tags.join(', ')} onChange={(event) => setDraft({ ...draft, tags: split(event.target.value) })} />
        </Field>
      </FieldGroup>

      <FieldGroup legend="Triage" columns={2}>
        <Choice
          label="Source tier"
          value={draft.sourceTier ?? 'Unknown'}
          options={SOURCE_TIERS}
          onChange={(sourceTier) => setDraft({ ...draft, sourceTier: sourceTier as IntakeItem['sourceTier'] })}
        />
        <Choice
          label="Signal decision"
          value={draft.signalDecision ?? 'Untriaged'}
          options={SIGNAL_DECISIONS}
          onChange={(signalDecision) =>
            setDraft({ ...draft, signalDecision: signalDecision as IntakeItem['signalDecision'] })
          }
        />
        <Choice
          label="Status"
          className="sm:col-span-2"
          value={draft.status}
          hint={blocked}
          options={INTAKE_STATUSES.map((status) => ({
            value: status,
            label: status === 'Active' && blocked ? 'Active — unavailable' : status,
            disabled: status === 'Active' && Boolean(blocked),
          }))}
          onChange={(status) => setDraft({ ...draft, status: status as IntakeItem['status'] })}
        />
      </FieldGroup>

      <FieldGroup legend="Scheduling" columns={2}>
        <Field label="Scheduled date">
          <Input
            type="date"
            min={isoDay()}
            value={draft.scheduledDate ?? ''}
            onChange={(event) => setDraft({ ...draft, scheduledDate: event.target.value || undefined })}
          />
        </Field>
        <Field label="Timebox (minutes)">
          <Input
            type="number"
            min={5}
            step={5}
            value={draft.durationMinutes ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, durationMinutes: event.target.value ? Number(event.target.value) : undefined })
            }
          />
        </Field>
        <Choice
          label="Day block"
          className="sm:col-span-2"
          value={draft.blockId ?? ''}
          clearable
          clearLabel="No block"
          placeholder="No block"
          options={DAY_BLOCKS.map((block) => ({ value: block.id, label: block.label }))}
          onChange={(blockId) => setDraft({ ...draft, blockId: (blockId || undefined) as IntakeItem['blockId'] })}
        />
      </FieldGroup>

      <FieldGroup legend="Linkage" columns={2}>
        <Choice
          label="PARA project"
          value={draft.projectId ?? ''}
          clearable
          clearLabel="No project"
          placeholder="No project"
          options={para.projects
            .filter((item) => !item.archivedAt)
            .map((item) => ({ value: item.id, label: item.name }))}
          onChange={(projectId) => setDraft({ ...draft, projectId: projectId || undefined })}
        />
        <Choice
          label="PARA area"
          value={draft.areaId ?? ''}
          clearable
          clearLabel="No area"
          placeholder="No area"
          options={para.areas.filter((item) => !item.archivedAt).map((item) => ({ value: item.id, label: item.name }))}
          onChange={(areaId) => setDraft({ ...draft, areaId: areaId || undefined })}
        />
        <Choice
          label="Next mode"
          className="sm:col-span-2"
          hint="Where this work goes once the current mode is finished."
          value={draft.nextMode ?? ''}
          clearable
          clearLabel="No transition yet"
          placeholder="No transition yet"
          options={INTAKE_MODES}
          onChange={(nextMode) => setDraft({ ...draft, nextMode: (nextMode || undefined) as IntakeMode | undefined })}
        />
      </FieldGroup>

      <FieldGroup legend="Outcome" columns={1}>
        <Field label="Desired outcome" hint="What changes when this is complete?">
          <Textarea
            rows={3}
            value={draft.desiredOutcome ?? ''}
            onChange={(event) => setDraft({ ...draft, desiredOutcome: event.target.value || undefined })}
          />
        </Field>
        <Field label="Result or handoff" hint="What did you learn, decide, fix, ship, encode, or practice?">
          <Textarea
            rows={4}
            value={draft.outputSummary ?? ''}
            onChange={(event) => setDraft({ ...draft, outputSummary: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function InformationIntakeView() {
  const [data, persist] = useInformationIntakeStore();
  const [para] = useParaStore();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useDeepLink('item', setSelectedId);
  // The dashboard's mode tiles link here; search already matches an item's mode.
  useDeepLink('q', setQuery);

  const selected = data.items.find((item) => item.id === selectedId) ?? null;
  const deepResearchActive = activeDeepResearchCount(data);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.items
      .filter((item) => status === 'all' || item.status === status)
      .filter(
        (item) =>
          !needle ||
          `${item.title} ${item.reason ?? ''} ${item.mode ?? ''} ${item.tags.join(' ')}`
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }, [data.items, query, status]);

  const capture = () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const item: IntakeItem = {
      id: newInformationIntakeId('intake'),
      title: title.trim(),
      url: url.trim() || undefined,
      reason: reason.trim() || undefined,
      sourceTier: 'Unknown',
      signalDecision: 'Untriaged',
      status: 'Inbox',
      tags: [],
      capturedAt: now,
      lastTouchedAt: now,
    };
    persist((current) => ({ ...current, items: [item, ...current.items] }));
    setSelectedId(item.id);
    setTitle('');
    setUrl('');
    setReason('');
  };

  const patch = (update: Partial<IntakeItem>) =>
    selected &&
    persist((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selected.id ? { ...item, ...update, lastTouchedAt: new Date().toISOString() } : item,
      ),
    }));

  const save = (next: IntakeItem) =>
    persist((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === next.id ? { ...next, lastTouchedAt: new Date().toISOString() } : item,
      ),
    }));

  const remove = (id: string) => {
    persist((current) => removeIntakeItem(current, id));
    setSelectedId(null);
  };

  /** Routing is an audited transition, not a form field, so it writes directly. */
  const chooseMode = (mode: IntakeMode) => {
    if (!selected) return;
    if (mode === 'Deep Research' && selected.status === 'Active' && selected.mode !== 'Deep Research' && deepResearchActive >= 3)
      return;
    const definition = INTAKE_MODE_DEFINITIONS.find((item) => item.mode === mode)!;
    persist((current) => {
      const transitioned = transitionResearch(
        current,
        { itemId: selected.id },
        mode,
        selected.mode ? `Rerouted from ${selected.mode}` : 'Routed from intake',
      );
      return {
        ...transitioned,
        items: transitioned.items.map((item) =>
          item.id === selected.id
            ? { ...item, durationMinutes: selected.durationMinutes ?? definition.defaultMinutes }
            : item,
        ),
      };
    });
  };

  const counts = (value: string) =>
    value === 'all' ? data.items.length : data.items.filter((item) => item.status === value).length;
  const paraName = (list: { id: string; name: string }[], id?: string) =>
    id ? list.find((item) => item.id === id)?.name : undefined;
  const definition = selected ? INTAKE_MODE_DEFINITIONS.find((item) => item.mode === selected.mode) : undefined;
  const blocked = selected ? activationHint(data, selected) : undefined;

  const captureForm = (
    <PopoverEditor title="Capture signal">
      <Field label="What caught your attention?">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && capture()}
        />
      </Field>
      <Field label="Source URL" hint="Optional.">
        <Input type="url" placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} />
      </Field>
      <Field label="Why save it?">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <Button className="w-full" onClick={capture} disabled={!title.trim()}>
        <Plus className="size-4" aria-hidden="true" />
        Capture
      </Button>
    </PopoverEditor>
  );

  return (
    <ViewShell
      title="Information Intake"
      icon={Inbox}
      subtitle="Capture first; choose the right depth second."
      actions={captureForm}
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search intake…" label="Search intake" />
          <FilterChips
            label="Filter intake by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: counts('all') },
              ...INTAKE_STATUSES.map((value) => ({ value, label: value, count: counts(value) })),
            ]}
          />
        </Toolbar>
      }
    >
      {visible.length === 0 ? (
        <EmptyPanel
          icon={Inbox}
          size="page"
          title={data.items.length === 0 ? 'Intake is clear' : 'Nothing matches'}
          description={
            data.items.length === 0
              ? 'Capture a signal, question, problem, or idea and route it to a mode.'
              : 'No captured item matches this search and status filter.'
          }
          action={
            data.items.length === 0 ? (
              captureForm
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <CardGrid>
          {visible.map((item) => (
            <RecordCard
              key={item.id}
              title={item.title}
              onOpen={() => setSelectedId(item.id)}
              badges={
                <>
                  <Badge variant={item.mode ? 'secondary' : 'outline'}>{item.mode ?? 'Unrouted'}</Badge>
                  <StatusBadge status={item.status} completedStatuses={['Done']} overrides={INTAKE_TONE} />
                </>
              }
              detail={
                <>
                  {item.reason && <p className="line-clamp-2">{item.reason}</p>}
                  {item.url && <LinkOut url={item.url} />}
                </>
              }
              footer={
                item.scheduledDate || item.durationMinutes
                  ? `${item.scheduledDate ?? 'Unscheduled'}${
                      item.durationMinutes ? ` · ${item.durationMinutes} min` : ''
                    }`
                  : undefined
              }
              actions={
                <ConfirmDelete
                  itemName={item.title}
                  itemLabel="intake item"
                  onDelete={() => remove(item.id)}
                  consequence={cascade(data, item.id)}
                />
              }
            />
          ))}
        </CardGrid>
      )}

      <RecordSheet
        record={selected}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? ''}
        subtitle={selected?.reason ? `Saved because: ${selected.reason}` : undefined}
        badges={
          selected && (
            <>
              <Badge variant={selected.mode ? 'secondary' : 'outline'}>{selected.mode ?? 'Unrouted'}</Badge>
              <StatusBadge status={selected.status} completedStatuses={['Done']} overrides={INTAKE_TONE} />
            </>
          )
        }
        renderEdit={(current, setCurrent) => (
          <IntakeFields draft={current} setDraft={setCurrent} para={para} data={data} />
        )}
        onSave={save}
        actions={
          selected && (
            <ConfirmDelete
              itemName={selected.title}
              itemLabel="intake item"
              onDelete={() => remove(selected.id)}
              consequence={cascade(data, selected.id)}
            />
          )
        }
      >
        {selected && (
          <div className="grid gap-3">
            <Panel
              title="Route by intent, not by content"
              icon={Compass}
              description="Urgent or broken → Problem-Solving. Curiosity only → Exploration. A choice → Decision Support. Systematic understanding → Deep Research. Making something → Creation. Staying current → Awareness."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {INTAKE_MODE_DEFINITIONS.map((item) => {
                  const active = selected.mode === item.mode;
                  const unavailable =
                    item.mode === 'Deep Research' &&
                    selected.status === 'Active' &&
                    selected.mode !== 'Deep Research' &&
                    deepResearchActive >= 3;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      aria-pressed={active}
                      disabled={unavailable}
                      onClick={() => chooseMode(item.mode)}
                      className={cn(
                        'rounded-md border p-2 text-left transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        active
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-surface-2',
                      )}
                    >
                      <span className="block text-xs font-semibold">{item.mode}</span>
                      <span className="mt-0.5 block text-xxs leading-snug text-muted-foreground">{item.question}</span>
                    </button>
                  );
                })}
              </div>
            </Panel>

            {definition && (
              <Panel title={`${definition.mode} contract`} description={definition.cadence}>
                <FactGrid>
                  <Fact label="Intent" value={definition.intent} />
                  <Fact label="Expected output" value={definition.output} />
                  <Fact label="Done when" value={definition.doneWhen} />
                  <Fact label="Quality test" value={definition.success} />
                </FactGrid>
              </Panel>
            )}

            <FactGrid>
              <Fact label="Source" value={selected.url && <LinkOut url={selected.url} />} placeholder="No source URL" />
              <Fact label="Tags" value={selected.tags.join(', ')} placeholder="No tags" />
              <Fact label="Source tier" value={selected.sourceTier} />
              <Fact label="Signal decision" value={selected.signalDecision} />
              <Fact label="Scheduled" value={selected.scheduledDate} placeholder="Unscheduled" />
              <Fact
                label="Timebox"
                value={selected.durationMinutes ? `${selected.durationMinutes} minutes` : undefined}
              />
              <Fact
                label="Day block"
                value={DAY_BLOCKS.find((block) => block.id === selected.blockId)?.label}
                placeholder="No block"
              />
              <Fact label="Next mode" value={selected.nextMode} placeholder="No transition yet" />
              <Fact label="PARA project" value={paraName(para.projects, selected.projectId)} placeholder="No project" />
              <Fact label="PARA area" value={paraName(para.areas, selected.areaId)} placeholder="No area" />
              <Fact
                label="Desired outcome"
                value={selected.desiredOutcome && <span className="whitespace-pre-wrap">{selected.desiredOutcome}</span>}
                wide
                emphasis
              />
              <Fact
                label="Result or handoff"
                value={selected.outputSummary && <span className="whitespace-pre-wrap">{selected.outputSummary}</span>}
                wide
              />
              <Fact label="Captured" value={selected.capturedAt.slice(0, 10)} />
              <Fact label="Last touched" value={selected.lastTouchedAt.slice(0, 10)} />
            </FactGrid>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={Boolean(blocked)} onClick={() => patch({ status: 'Active' })}>
                Start this mode
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => patch({ status: 'Done' })}>
                Mark done
              </Button>
              <Button size="sm" variant="ghost" onClick={() => patch({ status: 'Discarded' })}>
                Discard
              </Button>
              {blocked && <p className="text-xs text-warning">{blocked}</p>}
            </div>
          </div>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

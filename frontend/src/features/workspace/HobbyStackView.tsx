import { useMemo, useState } from 'react';
import { Archive, Beaker, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Badge, Button, Input, Progress, Textarea } from '@/ui';
import { ENERGY_EFFECTS, HOBBY_ANCHORS, HOBBY_ENERGIES, HOBBY_LAYERS, HOBBY_STATUSES, SOCIAL_MODES, completedSessions, mergeDocumentedHobbyStack, newHobbyId, trialProgress, type HobbyLane } from './hobbies';
import { useHobbyStore } from './useHobbyStore';
import { EntryPopover, EntryPopoverBody } from './EntryPopover';
import { Choice, Fact, Field } from './viewkit';

const blankLane = (): HobbyLane => ({ id: newHobbyId('hobby'), layer: 'Custom', title: '', purpose: '', status: 'Queued', anchor: 'None', energy: 'Medium', energyEffect: 'Neutral', socialMode: 'Flexible', artifactTarget: '', cadence: '', setup: '', location: '', nextAction: '' });

export function HobbyStackView() {
  const [data, setData] = useHobbyStore();
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<HobbyLane>(blankLane());
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const selected = data.hobbies.find((item) => item.id === selectedId);
  const grouped = useMemo(() => HOBBY_STATUSES.map((status) => ({ status, hobbies: data.hobbies.filter((item) => item.status === status) })).filter((group) => group.hobbies.length), [data.hobbies]);
  const view = (item: HobbyLane) => { setSelectedId(item.id); setDraft({ ...item }); setEditing(false); setEntryOpen(true); };
  const fresh = () => { setSelectedId(undefined); setDraft(blankLane()); setEditing(true); setEntryOpen(true); };
  const save = () => {
    if (!draft.title.trim()) return;
    setData((current) => ({ ...current, hobbies: selected ? current.hobbies.map((item) => item.id === draft.id ? { ...draft, title: draft.title.trim() } : item) : [...current.hobbies, { ...draft, title: draft.title.trim() }] }));
    setEntryOpen(false);
  };
  const remove = () => {
    if (!selected) return;
    setData((current) => ({ ...current, hobbies: current.hobbies.filter((item) => item.id !== selected.id), sessions: current.sessions.filter((item) => item.hobbyId !== selected.id), artifacts: current.artifacts.filter((item) => item.hobbyId !== selected.id) }));
    setEntryOpen(false);
  };

  return <div className="flex min-w-0 flex-1 overflow-hidden">
    <section className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5"><h2 className="text-sm font-semibold">Hobby stack</h2><span className="ml-auto" /><Button size="sm" variant="outline" onClick={() => setData(mergeDocumentedHobbyStack)}><Sparkles className="size-4" />Load documented stack</Button><Button size="sm" onClick={fresh}><Plus className="size-4" />New lane</Button></header>
      <div className="space-y-5 p-4">{grouped.length === 0 ? <div className="border-y border-dashed border-border px-3 py-8 text-sm text-muted-foreground">No hobby lanes yet. Load your documented stack or add one.</div> : grouped.map((group) => <section key={group.status}><h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">{group.status}<span className="tabular-nums">{group.hobbies.length}</span></h3><div className="divide-y divide-border border-y border-border">{group.hobbies.map((item) => <button key={item.id} type="button" onClick={() => view(item)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/20 ${selectedId === item.id && entryOpen ? 'bg-primary/5' : ''}`}><span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{item.layer}</span><div className="min-w-0 flex-1"><h4 className="truncate text-sm font-medium">{item.title}</h4><p className="mt-0.5 truncate text-xs text-muted-foreground">{item.purpose || 'No purpose stated.'}</p></div>{item.anchor !== 'None' && <span className="text-xs text-muted-foreground">{item.anchor}</span>}<span className="w-16 text-right text-xxs text-muted-foreground">{item.energy}</span><Progress value={trialProgress(data, item.id)} className="h-1.5 w-20" /><span className="w-8 text-right text-xxs tabular-nums text-muted-foreground">{completedSessions(data, item.id)}/6</span></button>)}</div></section>)}</div>
    </section>
    <EntryPopover open={entryOpen} onOpenChange={setEntryOpen} title={selected ? selected.title : 'New hobby lane'} description={selected ? `${selected.layer} · ${selected.status}` : 'Define a low-friction hobby lane.'}>
      <EntryPopoverBody>{!editing && selected ? <div className="space-y-5 p-5"><div className="flex flex-wrap gap-2"><Badge variant="secondary">{selected.layer}</Badge><Badge variant="outline">{selected.status}</Badge><Badge variant="outline">{selected.energy} energy</Badge><Button className="ml-auto" size="sm" onClick={() => setEditing(true)}>Edit</Button></div><p className="text-sm leading-6">{selected.purpose || 'No purpose stated yet.'}</p><div className="grid gap-3 sm:grid-cols-2"><Fact label="Next session" value={selected.nextAction}/><Fact label="Artifact target" value={selected.artifactTarget}/><Fact label="Cadence" value={selected.cadence}/><Fact label="Location" value={selected.location}/><Fact label="Setup" value={selected.setup}/><Fact label="Social mode" value={selected.socialMode}/></div><div><div className="mb-2 flex justify-between text-xs"><span>Six-session trial</span><span>{completedSessions(data, selected.id)}/6</span></div><Progress value={trialProgress(data, selected.id)}/></div></div> : <div className="space-y-3 p-5"><div className="flex items-center gap-2"><Beaker className="size-4" /><h3 className="text-sm font-semibold">{selected ? 'Edit lane' : 'New hobby lane'}</h3></div>
      <Field label="Name"><Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Hobby or combined lane" /></Field>
      <div className="grid grid-cols-2 gap-2"><Choice label="Layer" value={draft.layer} options={HOBBY_LAYERS} onChange={(layer) => setDraft({ ...draft, layer: layer as HobbyLane['layer'] })} /><Choice label="Status" value={draft.status} options={HOBBY_STATUSES} onChange={(status) => setDraft({ ...draft, status: status as HobbyLane['status'] })} /></div>
      <Field label="Purpose"><Textarea rows={2} value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2"><Choice label="Anchor" value={draft.anchor} options={HOBBY_ANCHORS} onChange={(anchor) => setDraft({ ...draft, anchor: anchor as HobbyLane['anchor'] })} /><Choice label="Energy needed" value={draft.energy} options={HOBBY_ENERGIES} onChange={(energy) => setDraft({ ...draft, energy: energy as HobbyLane['energy'] })} /></div>
      <div className="grid grid-cols-2 gap-2"><Choice label="Energy effect" value={draft.energyEffect} options={ENERGY_EFFECTS} onChange={(energyEffect) => setDraft({ ...draft, energyEffect: energyEffect as HobbyLane['energyEffect'] })} /><Choice label="Mode" value={draft.socialMode} options={SOCIAL_MODES} onChange={(socialMode) => setDraft({ ...draft, socialMode: socialMode as HobbyLane['socialMode'] })} /></div>
      <Field label="Artifact / output"><Input value={draft.artifactTarget} onChange={(event) => setDraft({ ...draft, artifactTarget: event.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Cadence"><Input value={draft.cadence} onChange={(event) => setDraft({ ...draft, cadence: event.target.value })} /></Field><Field label="Location"><Input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></Field></div>
      <Field label="Frictionless setup"><Textarea rows={2} value={draft.setup} onChange={(event) => setDraft({ ...draft, setup: event.target.value })} placeholder="Tools ready, location defined…" /></Field>
      <Field label="Next session action"><Textarea rows={2} value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} placeholder="Pre-select session 1—or session 7." /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Trial start"><Input type="date" value={draft.trialStart ?? ''} onChange={(event) => setDraft({ ...draft, trialStart: event.target.value || undefined })} /></Field><Field label="Trial end"><Input type="date" value={draft.trialEnd ?? ''} onChange={(event) => setDraft({ ...draft, trialEnd: event.target.value || undefined })} /></Field></div>
      <div className="flex gap-2 pt-2"><Button className="flex-1" onClick={save} disabled={!draft.title.trim()}>{selected ? 'Save changes' : 'Add lane'}</Button>{selected && <Button variant="outline" size="icon" aria-label="Delete lane" onClick={remove}><Trash2 className="size-4" /></Button>}<Button variant="ghost" size="icon" aria-label="Cancel" onClick={() => selected ? setEditing(false) : setEntryOpen(false)}><Archive className="size-4" /></Button></div>
    </div>}</EntryPopoverBody></EntryPopover>
  </div>;
}


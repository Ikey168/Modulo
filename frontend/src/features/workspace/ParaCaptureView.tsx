import { useMemo, useRef, useState } from 'react';
import { Box, FolderKanban, Inbox, ListTodo, Map, Plus } from 'lucide-react';
import { Badge, Button, Input, Textarea, ToastAction, useToast } from '@/ui';
import {
  Choice,
  EmptyPanel,
  Field,
  FilterChips,
  LinkOut,
  ListRow,
  ListRows,
  Panel,
  SearchInput,
  Toolbar,
  ViewShell,
} from './viewkit';
import { PopoverEditor } from './EntryPopover';
import { newParaId, type InboxKind, type ParaData, type ParaInboxItem } from './para';
import { routeCapture, type ParaDestination } from './paraRouting';
import { useParaStore } from './useParaStore';

const KINDS: InboxKind[] = ['Thought', 'Task', 'Idea', 'Link'];

/**
 * Routing is a one-way move out of the inbox, so the destinations are ranked
 * rather than rendered as four identical outline buttons: Task is the default
 * landing place, the rest are secondary.
 */
const DESTINATIONS: {
  value: ParaDestination;
  label: string;
  icon: typeof ListTodo;
  variant: 'primary' | 'outline';
}[] = [
  { value: 'task', label: 'Task', icon: ListTodo, variant: 'primary' },
  { value: 'project', label: 'Project', icon: FolderKanban, variant: 'outline' },
  { value: 'area', label: 'Area', icon: Map, variant: 'outline' },
  { value: 'resource', label: 'Resource', icon: Box, variant: 'outline' },
];

const emptyCapture = (): ParaInboxItem => ({
  id: newParaId('capture'),
  title: '',
  kind: 'Thought',
  detail: undefined,
  capturedAt: new Date().toISOString(),
});

export function ParaCaptureView() {
  const [data, persist] = useParaStore();
  const [draft, setDraft] = useState(emptyCapture);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<string>('all');
  const { toast } = useToast();
  /** Snapshot taken immediately before a route, so the toast can undo it exactly. */
  const undoSnapshot = useRef<ParaData | null>(null);

  const capture = () => {
    if (!draft.title.trim()) return;
    persist((current) => ({
      ...current,
      inbox: [
        {
          ...draft,
          title: draft.title.trim(),
          detail: draft.detail?.trim() || undefined,
          capturedAt: new Date().toISOString(),
        },
        ...current.inbox,
      ],
    }));
    setDraft(emptyCapture());
  };

  const route = (item: ParaInboxItem, destination: ParaDestination) => {
    const label = DESTINATIONS.find((entry) => entry.value === destination)?.label ?? destination;
    persist((current) => {
      undoSnapshot.current = current;
      return routeCapture(current, item, destination);
    });
    toast({
      title: `Filed as ${label.toLowerCase()}`,
      description: `“${item.title}” left the inbox and is now a ${label.toLowerCase()}.`,
      action: (
        <ToastAction
          altText={`Undo filing ${item.title} as ${label.toLowerCase()}`}
          onClick={() => {
            const snapshot = undoSnapshot.current;
            if (snapshot) persist(snapshot);
            undoSnapshot.current = null;
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  const inbox = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.inbox.filter((item) => {
      if (kind !== 'all' && item.kind !== kind) return false;
      return !needle || `${item.title} ${item.detail ?? ''}`.toLowerCase().includes(needle);
    });
  }, [data.inbox, query, kind]);

  return (
    <ViewShell
      title="Capture & Inbox Router"
      icon={Inbox}
      subtitle="Capture first; decide what it means during processing."
      actions={
        <PopoverEditor title="Capture" description="Everything lands in the inbox until you route it.">
          <Field label="What has your attention?">
            <Input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') capture();
              }}
            />
          </Field>
          <Choice
            label="Kind"
            value={draft.kind}
            options={KINDS}
            onChange={(next) => setDraft({ ...draft, kind: next as InboxKind })}
          />
          <Field label="Detail or URL" hint="Optional. A Link capture files its detail as the resource URL.">
            <Textarea
              rows={3}
              value={draft.detail ?? ''}
              onChange={(event) => setDraft({ ...draft, detail: event.target.value || undefined })}
            />
          </Field>
          <Button onClick={capture} disabled={!draft.title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Capture
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search the inbox…" label="Search the inbox" />
          <FilterChips
            label="Filter captures by kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: 'All', count: data.inbox.length },
              ...KINDS.map((value) => ({
                value,
                label: value,
                count: data.inbox.filter((item) => item.kind === value).length,
              })),
            ]}
          />
        </Toolbar>
      }
    >
      <Panel
        title="Inbox"
        icon={Inbox}
        description="Routing moves a capture out of the inbox. The toast that follows can undo it."
        bodyClassName="p-0"
      >
        {inbox.length === 0 ? (
          <EmptyPanel
            icon={Inbox}
            title={data.inbox.length === 0 ? 'Inbox zero' : 'Nothing matches'}
            description={
              data.inbox.length === 0
                ? 'The inbox is a temporary decision queue, not a permanent home.'
                : 'Try another search or kind filter.'
            }
          />
        ) : (
          <ListRows>
            {inbox.map((item) => (
              <ListRow
                key={item.id}
                className="flex-wrap"
                title={item.title}
                detail={
                  item.kind === 'Link' && item.detail ? (
                    <LinkOut url={item.detail} />
                  ) : (
                    item.detail || `Captured ${item.capturedAt.slice(0, 10)}`
                  )
                }
                meta={<Badge variant="secondary">{item.kind}</Badge>}
                actions={
                  <span className="flex flex-wrap items-center gap-1">
                    {DESTINATIONS.map((destination) => {
                      const Icon = destination.icon;
                      return (
                        <Button
                          key={destination.value}
                          size="sm"
                          variant={destination.variant}
                          onClick={() => route(item, destination.value)}
                          aria-label={`File “${item.title}” as a ${destination.label.toLowerCase()}`}
                        >
                          <Icon className="size-3.5" aria-hidden="true" />
                          {destination.label}
                        </Button>
                      );
                    })}
                  </span>
                }
              />
            ))}
          </ListRows>
        )}
      </Panel>
    </ViewShell>
  );
}

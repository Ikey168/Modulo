import { searchEntities, searchExcerpt } from './searchIndex';
import { useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Input,
  Label,
  Textarea,
} from '@/ui';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/ui/command';
import type { WorkspaceData } from './useCoreWorkspace';
import type { LifeOsEntity } from './lifeOs';
import { entityPath } from './entityNavigation';
import { useServerWorkspaceStore } from './useWorkspaceStore';

interface QuickCaptureDraft { title: string; content: string; }
const QUICK_CAPTURE_LEGACY_KEY = 'modulo-quick-capture-v1';
const emptyQuickCapture = (): QuickCaptureDraft => ({ title: '', content: '' });
function parseQuickCapture(value: unknown): QuickCaptureDraft {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return emptyQuickCapture();
  const raw = value as Record<string, unknown>;
  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
  };
}


export function WorkspaceCommandPalette({
  open,
  onOpenChange,
  data,
  views,
  entities,
  navigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: WorkspaceData;
  views: Array<{ id: string; label: string }>;
  entities: LifeOsEntity[];
  navigate: (path: string) => void;
}) {
  const [capture, setCapture] = useState(false);
  const [captureDraft, setCaptureDraft] = useServerWorkspaceStore(
    'quick-capture',
    'draft',
    'modulo.workspace.quick-capture',
    emptyQuickCapture(),
    parseQuickCapture,
    QUICK_CAPTURE_LEGACY_KEY,
    'Quick capture draft',
  );
  const title = captureDraft.title;
  const content = captureDraft.content;
  const [query, setQuery] = useState('');
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const updateCapture = (next: QuickCaptureDraft) => {
    if (!setCaptureDraft(next))
      setError('Draft synchronization is unavailable. Keep this page open until the note is created.');
  };
  const go = (path: string) => {
    onOpenChange(false);
    setQuery('');
    navigate(path);
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || !title.trim()) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const note = await data.createNote(title.trim(), content);
      if (!note) {
        setError('Could not create the note. Your text is still here; retry.');
        return;
      }
      setCaptureDraft(emptyQuickCapture());
      setCapture(false);
      go(`notes?note=${note.id}`);
    } catch {
      setError('Could not create the note. Retry.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const results = searchEntities(entities, query);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="gap-3 p-4 phone:max-h-[min(88dvh,var(--app-viewport-height))]">
        <DialogTitle>
          {capture ? 'Quick capture' : 'Search and commands'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Find a note or record, switch views, or capture a new note.
        </DialogDescription>
        {!capture && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {capture ? (
          <form
            className="space-y-3"
            onSubmit={(event) => void create(event)}
            onKeyDown={(event) => {
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key === 'Enter' &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.requestSubmit();
              }
            }}
          >
            <Label htmlFor="capture-title">Title</Label>
            <Input
              id="capture-title"
              required
              autoFocus
              value={title}
              onChange={(event) =>
                updateCapture({ title: event.target.value, content })
              }
              disabled={busy}
            />
            <Label htmlFor="capture-content">Note</Label>
            <Textarea
              id="capture-content"
              rows={6}
              value={content}
              onChange={(event) =>
                updateCapture({ title, content: event.target.value })
              }
              disabled={busy}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setCapture(false)}
              >
                Back
              </Button>
              <Button type="submit" disabled={busy || !title.trim()}>
                {busy ? 'Saving…' : 'Create note'}
              </Button>
            </div>
          </form>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search notes, records, or views…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup heading="Actions">
                <CommandItem value="capture" onSelect={() => setCapture(true)}>
                  Quick capture a note
                </CommandItem>
                <CommandItem value="recovery" onSelect={() => go('recovery')}>
                  Open Trash and recovery
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Views">
                {views
                  .filter((view) =>
                    view.label.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((view) => (
                    <CommandItem
                      key={view.id}
                      value={`view:${view.id}`}
                      onSelect={() => go(view.id)}
                    >
                      {view.label}
                    </CommandItem>
                  ))}
              </CommandGroup>
              <CommandGroup heading="Notes and records">
                {results.map((entity) => (
                  <CommandItem
                    key={entity.uid}
                    value={entity.uid}
                    onSelect={() => go(entityPath(entity))}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {entity.title}
                      {query.trim() && <span className="block truncate text-xs text-muted-foreground">{searchExcerpt(entity, query)}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entity.source}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </DialogContent>
    </Dialog>
  );
}

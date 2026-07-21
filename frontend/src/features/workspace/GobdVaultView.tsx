// GoBD vault view (#368): all retained documents (notes tagged retain/…) with
// class, document date, retention end, and anchor status; un-anchored retained
// records are flagged and can be anchored in place. Retention classes are
// editable. Nothing is ever auto-deleted — the vault reports, the human
// decides. Business hub tab.
import { useMemo, useState } from 'react';
import { Anchor, Archive, Settings2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button, EmptyState, Input, useToast } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import {
  readRetentionClasses,
  vaultEntries,
  writeRetentionClasses,
  type RetentionClass,
} from './gobd';

function ClassesEditor({ classes, onChange }: { classes: RetentionClass[]; onChange: (c: RetentionClass[]) => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/20 p-3">
      {classes.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2 text-sm">
          <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">retain/{c.id}</span>
          <span className="min-w-0 flex-1 truncate">{c.label}</span>
          <Input
            value={String(c.years)}
            aria-label={`Retention years for ${c.label}`}
            onChange={(e) => {
              const years = Number(e.target.value);
              if (!Number.isFinite(years) || years < 0) return;
              const next = classes.slice();
              next[i] = { ...c, years };
              onChange(next);
            }}
            className="h-7 w-14 text-sm"
          />
          <span className="text-xs text-muted-foreground">years</span>
        </div>
      ))}
      <p className="text-xxs text-muted-foreground">
        Defaults follow current German rules (Belege 8y since 2025, Bücher 10y, Briefe 6y) — confirm with your
        Steuerberater.
      </p>
    </div>
  );
}

export function GobdVaultView({ data, onOpenNote }: WorkspaceViewProps) {
  const { toast } = useToast();
  const [classes, setClasses] = useState<RetentionClass[]>(() => readRetentionClasses());
  const [showConfig, setShowConfig] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const entries = useMemo(() => vaultEntries(data.notes, classes, today), [data.notes, classes, today]);
  const unanchored = entries.filter((e) => !e.anchored);

  const anchor = async (noteId: number) => {
    setBusyId(noteId);
    try {
      await data.anchorNote(noteId);
      toast({ title: 'Anchor requested', description: 'The record hash is being anchored on-chain.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Document vault</h2>
          <span className="text-xs text-muted-foreground">
            {entries.length} retained · {unanchored.length} not anchored
          </span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setShowConfig((v) => !v)}>
            <Settings2 className="size-4" aria-hidden="true" />
            Retention classes
          </Button>
        </div>
        {showConfig && (
          <div className="mt-3">
            <ClassesEditor
              classes={classes}
              onChange={(next) => {
                setClasses(next);
                writeRetentionClasses(next);
              }}
            />
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<Archive className="size-5" />}
            title="Nothing in the vault"
            description="Tag a note retain/belege, retain/buecher or retain/briefe and it is tracked here with its retention period and anchor status."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((e) => (
            <li key={`${e.noteId}-${e.classId}`} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <button
                type="button"
                onClick={() => onOpenNote(e.noteId)}
                className="min-w-0 flex-1 truncate text-left text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {e.noteTitle}
              </button>
              <span className="rounded-full border border-border px-1.5 text-xxs text-muted-foreground" title={e.classLabel}>
                retain/{e.classId}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{e.docDate}</span>
              <span
                className={
                  e.expired
                    ? 'font-mono text-xs text-muted-foreground line-through'
                    : 'font-mono text-xs text-muted-foreground'
                }
                title={e.expired ? 'Retention period has passed — review before any deletion' : `Retain until ${e.retainUntil}`}
              >
                → {e.retainUntil}
              </span>
              {e.anchored ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 px-2 py-0.5 text-xxs text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-3" aria-hidden="true" />
                  anchored
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 text-xxs text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="size-3" aria-hidden="true" />
                    not anchored
                  </span>
                  <Button size="sm" variant="ghost" disabled={busyId === e.noteId} onClick={() => void anchor(e.noteId)}>
                    <Anchor className="size-4" aria-hidden="true" />
                    Anchor now
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="px-4 pb-3 text-xxs text-muted-foreground">
        Anchoring evidences integrity; GoBD additionally requires a documented process — insert the
        Verfahrensdokumentation template from the editor toolbar and keep it current. Expired records are only
        reported, never deleted automatically.
      </p>
    </div>
  );
}

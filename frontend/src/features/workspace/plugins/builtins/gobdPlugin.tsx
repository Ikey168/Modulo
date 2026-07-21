// GoBD document vault (#368) — retention tracking with anchored-integrity
// status for notes tagged retain/<class>, a retention/anchor note panel, and
// the Verfahrensdokumentation template. Business hub tab.
import { Archive, ShieldCheck } from 'lucide-react';
import { GobdVaultView } from '../../GobdVaultView';
import {
  readRetentionClasses,
  retentionEnd,
  RETAIN_TAG_PREFIX,
  VERFAHRENSDOKUMENTATION_TEMPLATE,
} from '../../gobd';
import type { NotePanelProps, PluginModule, WorkspaceViewProps } from '../types';

function VaultSurface(p: WorkspaceViewProps) {
  return <GobdVaultView {...p} />;
}

function RetentionPanel({ note }: NotePanelProps) {
  const retainTags = note.tags.filter((t) => t.name.startsWith(RETAIN_TAG_PREFIX));
  if (retainTags.length === 0) {
    return (
      <p className="px-0.5 py-1 text-xs text-muted-foreground">
        Not retained — tag this note <span className="font-mono">retain/&lt;class&gt;</span> to track it in the vault.
      </p>
    );
  }
  const classes = readRetentionClasses();
  const docDate = (note.createdAt ?? note.updatedAt ?? '').slice(0, 10);
  return (
    <div className="flex flex-col gap-1 py-1 text-xs">
      {retainTags.map((t) => {
        const id = t.name.slice(RETAIN_TAG_PREFIX.length);
        const cls = classes.find((c) => c.id === id);
        return (
          <div key={t.id} className="flex items-center justify-between gap-2">
            <span className="font-mono">{t.name}</span>
            <span className="text-muted-foreground">
              {docDate ? `until ${retentionEnd(docDate, cls?.years ?? 10)}` : `${cls?.years ?? 10}y`}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-1">
        {note.isOnBlockchain ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-3" aria-hidden="true" />
            anchored{note.blockchainTxHash ? ` (${note.blockchainTxHash.slice(0, 10)}…)` : ''}
          </span>
        ) : (
          <span className="text-amber-600 dark:text-amber-400">not anchored — use the vault tab</span>
        )}
      </div>
    </div>
  );
}

const gobdPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'vault', label: 'Vault', icon: Archive, order: 55, mode: 'business', component: VaultSurface });
    ctx.addNotePanel({ id: 'gobd-retention', title: 'Retention', order: 60, component: RetentionPanel });
    ctx.addEditorAction({
      id: 'insert-verfahrensdokumentation',
      label: 'Insert Verfahrensdokumentation',
      icon: Archive,
      run: (c) => c.insertAtCursor(`\n\n${VERFAHRENSDOKUMENTATION_TEMPLATE}\n`),
    });
  },
};

export default gobdPlugin;

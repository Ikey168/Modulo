import { useReducer, useState } from 'react';
import { Check, Workflow as BlueprintIcon } from 'lucide-react';
import { Button, Card, Spinner, useToast } from '@/ui';
import { PLUGINS } from './plugins';
import { usePlugins } from './plugins/PluginProvider';
import { PACKS, type Pack } from './plugins/packs';
import { addLocalBlueprints, hasLocalBlueprint } from '../blueprint/localBlueprints';

const PLUGIN_BY_ID = new Map(PLUGINS.map((p) => [p.id, p]));

/**
 * Packs are curated bundles of plugins and blueprints. Installing a pack
 * installs each of its plugins (via the plugin runtime) and adds each of its
 * blueprints (via the client-side blueprint store), so one click sets up a
 * whole workflow.
 */
export function PacksView() {
  const plugins = usePlugins();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0); // re-render after blueprints change

  const isInstalled = (pack: Pack) =>
    pack.pluginIds.every((id) => plugins.isInstalled(id)) &&
    pack.blueprints.every((b) => hasLocalBlueprint(b.name));

  const install = async (pack: Pack) => {
    setBusy(pack.id);
    try {
      for (const id of pack.pluginIds) await plugins.install(id);
      addLocalBlueprints(pack.blueprints);
      bump();
      toast({
        title: `Installed ${pack.name}`,
        description: `${pack.pluginIds.length} plugin${pack.pluginIds.length === 1 ? '' : 's'} and ${pack.blueprints.length} blueprint${pack.blueprints.length === 1 ? '' : 's'} added.`,
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Install failed', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <p className="mb-4 max-w-2xl text-[13px] text-muted-foreground">
        Packs bundle several plugins and ready-made blueprints. Installing one sets up everything it needs in a single step.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PACKS.map((pack) => (
          <PackCard key={pack.id} pack={pack} installed={isInstalled(pack)} busy={busy === pack.id} onInstall={() => install(pack)} />
        ))}
      </div>
    </div>
  );
}

function PackCard({ pack, installed, busy, onInstall }: { pack: Pack; installed: boolean; busy: boolean; onInstall: () => void }) {
  const Icon = pack.icon;
  const packPlugins = pack.pluginIds.map((id) => PLUGIN_BY_ID.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <Card className="flex flex-col p-4">
      <div className="mb-2.5 flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden="true">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{pack.name}</div>
          <div className="font-mono text-xxs uppercase tracking-wide text-muted-foreground">{pack.category}</div>
        </div>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{pack.description}</p>

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {packPlugins.map((p) => {
          const PluginGlyph = p.icon;
          return (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xxs text-subtle-foreground"
            >
              <PluginGlyph className="size-3 text-primary-hover" aria-hidden="true" />
              {p.name}
            </span>
          );
        })}
        {pack.blueprints.map((b) => (
          <span
            key={b.name}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xxs text-subtle-foreground"
          >
            <BlueprintIcon className="size-3 text-warning" aria-hidden="true" />
            {b.name}
          </span>
        ))}
      </div>

      <div className="mt-auto">
        <Button
          variant={installed ? 'outline' : 'primary'}
          size="sm"
          disabled={installed || busy}
          onClick={onInstall}
          className="w-full"
          aria-label={`Install ${pack.name} pack`}
        >
          {busy ? (
            <>
              <Spinner className="size-3.5" /> Installing…
            </>
          ) : installed ? (
            <>
              <Check className="size-4" /> Installed
            </>
          ) : (
            'Install pack'
          )}
        </Button>
      </div>
    </Card>
  );
}

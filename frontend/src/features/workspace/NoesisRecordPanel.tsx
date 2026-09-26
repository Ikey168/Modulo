import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui';
import { authService } from '../auth/authService';
import type { PluginStateClient } from '../../services/pluginStateClient';
import { usePlugins } from './plugins/PluginProvider';
import { intakeCall, intakePreflight, type IntakeReadiness } from './plugins/builtins/noesisIntakeApi';
import { LINK_NAMESPACE, linkKey, modesForPlugin, readLink, refreshLink, startModeFromRecord, type NoesisMode } from './noesisRecordLinks';

/**
 * Noesis actions on a dedicated plugin's own record (#474): start the modes
 * this plugin supports from the record, and see the linked sessions with their
 * current status. Hidden for plugins without a mode.
 */
export function NoesisRecordPanel({ pluginId, collection, recordId, title, summary }: {
  pluginId: string; collection: string; recordId: string; title: string; summary?: string;
}) {
  const modes = modesForPlugin(pluginId);
  const plugins = usePlugins();
  const [links, setLinks] = useState<PluginStateClient>();
  const [readiness, setReadiness] = useState<IntakeReadiness | { unavailable: string }>();
  const [busy, setBusy] = useState<NoesisMode>();
  const [error, setError] = useState('');
  const [, bump] = useState(0);

  useEffect(() => {
    if (!modes.length) return;
    let active = true;
    plugins.workspaceState(LINK_NAMESPACE).then(client => { if (active) setLinks(client); }, () => {});
    intakePreflight().then(result => {
      if (active) setReadiness(result.available && result.readiness ? result.readiness : { unavailable: result.reason ?? 'NOESIS_UNAVAILABLE' });
    }, () => { if (active) setReadiness({ unavailable: 'NOESIS_UNREACHABLE' }); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per record page
  }, [pluginId]);
  useEffect(() => links?.watch(() => bump(n => n + 1)), [links]);

  const session = authService.stateSession?.();
  const ref = session ? { issuer: session.issuer, subject: session.subject, workspace: 'personal' as const, pluginId, collection, recordId } : undefined;
  const deps = useCallback(() => links ? { links, call: intakeCall } : undefined, [links]);

  useEffect(() => {
    const current = deps();
    if (!current || !ref) return;
    for (const mode of modes) void refreshLink(linkKey(ref, mode), current).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when the link store opens
  }, [links, recordId]);

  if (!modes.length || !ref) return null;
  const startable = (mode: NoesisMode) => readiness && !('unavailable' in readiness)
    && readiness.modes.some(item => item.mode === mode && item.native_start_possible);
  const start = async (mode: NoesisMode) => {
    const current = deps();
    if (!current) return;
    setBusy(mode); setError('');
    try { await startModeFromRecord(ref, mode, [title, summary].filter(Boolean).join('\n\n'), current); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Noesis could not start this mode.'); }
    finally { setBusy(undefined); }
  };

  return <section aria-label="Noesis" className="space-y-2 rounded-md border border-border p-3">
    <h3 className="text-sm font-semibold">Noesis</h3>
    {readiness && 'unavailable' in readiness && (
      <p className="text-xs text-muted-foreground">Noesis is not available on this server ({readiness.unavailable}). Linked sessions stay listed below.</p>
    )}
    <ul className="space-y-1.5">
      {modes.map(mode => {
        const link = links ? readLink(links, linkKey(ref, mode)) : undefined;
        return <li key={mode} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 flex-1">{mode}</span>
          {link?.noesis ? (
            <span className="text-xs text-muted-foreground">Session {link.status}{link.noesis.revision ? ` · revision ${link.noesis.revision}` : ''}</span>
          ) : (
            <Button size="sm" variant="outline" disabled={!startable(mode) || busy !== undefined || !links}
              title={startable(mode) ? undefined : 'Noesis cannot start this mode here yet.'}
              onClick={() => void start(mode)}>
              {busy === mode ? 'Starting…' : link?.status === 'failed' ? `Retry ${mode}` : `Start ${mode}`}
            </Button>
          )}
        </li>;
      })}
    </ul>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <Link to="/app/information-intake" className="text-xs underline">Open Information Intake</Link>
  </section>;
}

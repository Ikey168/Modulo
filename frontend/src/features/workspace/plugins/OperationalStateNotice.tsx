import { PluginStateNotice } from './PluginStateNotice';
interface Props {
  status: string; error?: string; conflict?: unknown; ready: boolean; legacy: boolean;
  retry: () => Promise<void>; resolve: (choice: 'local' | 'remote') => Promise<void>;
  importLegacy: () => Promise<void>; exportRecovery: () => void;
}
export function OperationalStateNotice({ label, ...state }: Props & { label: string }) {
  return <>
    <PluginStateNotice {...state} />
    {(state.legacy || state.error || state.conflict) && <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm">
      {state.legacy && <><span>{label} are available in this browser.</span>
        <button type="button" className="underline" disabled={!state.ready} onClick={() => void state.importLegacy()}>Import into this account</button></>}
      <button type="button" className="underline" onClick={state.exportRecovery}>Export recovery data</button>
    </div>}
  </>;
}

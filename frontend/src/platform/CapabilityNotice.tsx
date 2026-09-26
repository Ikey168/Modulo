import { capabilityStatus, type Capability } from './capabilities';

/** The specific, actionable state for a capability this platform lacks; never a silent no-op. */
export function CapabilityNotice({ capability }: { capability: Capability }) {
  const status = capabilityStatus(capability);
  if (status.available) return null;
  return <p role="status" className="text-xs text-muted-foreground">
    {status.message}
    {status.issue && <> {' '}<a className="underline" href={status.issue} target="_blank" rel="noreferrer">Tracking issue</a></>}
  </p>;
}

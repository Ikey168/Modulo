import { journalWrite, RECOVERY_KEY } from './workspaceRecovery';
/** One write contract for local workspace collections. Never report a failed write as saved. */
export const WORKSPACE_STORAGE_EVENT = 'modulo:workspace-storage';
const failures = new Set<string>();
let failureRevision = 0;

export const hasWorkspaceStorageFailure = (): boolean => failures.size > 0;
export const workspaceStorageFailureRevision = (): number => failureRevision;

export function writeWorkspaceJson(
  key: string,
  value: unknown,
  changedEvent?: string,
  detail?: string,
): boolean {
  let history: string | null = null;
  try {
    history = localStorage.getItem(RECOVERY_KEY);
    const serialized = JSON.stringify(value);
    journalWrite(key, localStorage.getItem(key), serialized);
    localStorage.setItem(key, serialized);
  } catch {
    try {
      if (history === null) localStorage.removeItem(RECOVERY_KEY);
      else localStorage.setItem(RECOVERY_KEY, history);
    } catch {
      /* Original data remains intact. */
    }
    failures.add(key);
    failureRevision += 1;
    window.dispatchEvent(
      new CustomEvent(WORKSPACE_STORAGE_EVENT, { detail: key }),
    );
    return false;
  }
  failures.delete(key);
  if (changedEvent)
    window.dispatchEvent(
      detail === undefined
        ? new Event(changedEvent)
        : new CustomEvent(changedEvent, { detail }),
    );
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_STORAGE_EVENT, { detail: key }),
  );
  return true;
}

export function subscribeWorkspaceStorage(listener: () => void): () => void {
  window.addEventListener(WORKSPACE_STORAGE_EVENT, listener);
  return () => window.removeEventListener(WORKSPACE_STORAGE_EVENT, listener);
}

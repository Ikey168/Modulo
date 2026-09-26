import { authenticatedRequest } from '../../services/authenticatedRequest';

/**
 * Praxis tasks through Modulo's server (#525). The server talks to Praxis with its
 * mTLS certificate and token and asserts the signed-in user's identity; this client
 * never names a user and never sees a Praxis credential.
 */

export type ProcessState = 'pending' | 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled';
export type ControlOperation = 'cancel' | 'suspend' | 'resume' | 'signal' | 'retry';

export interface ControlAvailability {
  supported: boolean;
  available: boolean;
  reason: 'executor_unsupported' | 'executor_features_unknown' | 'process_state' | 'process_not_failed' | null;
}

export interface ProcessSummary {
  state: ProcessState;
  executor: string;
  finished: boolean;
  execution: { status: string | null; reason: string | null };
  verification:
    | { available: true; approved: boolean; requiredFailures: string[]; missingOutputs: string[] }
    | { available: false; approved: null };
  publishable: boolean;
}

export interface ProcessView {
  process_id: string;
  attempt_id: string;
  state: ProcessState;
  parent_id: string | null;
  children: string[];
  spec: { objective: string; executor: string };
  blocking_reason: string | null;
  summary: ProcessSummary;
  controls: Record<ControlOperation, ControlAvailability>;
}

export interface Submission {
  processId: string;
  objective: string;
  executor: string;
  publishRequested: boolean;
  createdAt: string | null;
}

export interface Approval {
  effect_id: string;
  process_id: string;
  attempt_id: string;
  kind: string;
  target: string;
  version: number;
  reversible: boolean;
  payload: Record<string, unknown>;
}

export interface PraxisStatus {
  configured: boolean;
  executors: Record<string, string[]>;
}

export interface PraxisEvent {
  cursor: number;
  event: { event_id: string; process_id: string; type: string; timestamp?: string; payload: Record<string, unknown> };
}

export class PraxisError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly retryAfter?: number) {
    super(PRAXIS_MESSAGES[code] ?? `Praxis request failed (${code}).`);
  }
}

/** Plain-language explanations for the codes users can actually hit. */
export const PRAXIS_MESSAGES: Record<string, string> = {
  praxis_not_configured: 'This Modulo server is not connected to Praxis.',
  praxis_unavailable: 'Praxis cannot be reached right now. Try again shortly.',
  praxis_authentication_failed: 'Modulo could not authenticate to Praxis. An administrator needs to check its certificate and token.',
  stale_process_attempt: 'The task changed since you loaded it. It has been refreshed; try again.',
  control_unsupported_by_executor: 'This executor does not support that control.',
  control_rejected: 'Praxis refused that control for the task in its current state.',
  approval_rejected: 'Praxis refused that decision. The task may have moved on; it has been refreshed.',
  stale_effect_process: 'That approval belongs to an earlier attempt. The list has been refreshed.',
  publication_ineligible: 'Only completed, verified results can be published.',
  process_not_terminal: 'The task has not finished yet.',
  route_not_found: 'Publishing to the knowledge base is turned off on the Praxis host.',
  unavailable: 'The knowledge base is unavailable. Try publishing again later.',
  rate_limited: 'Too many requests. Wait a moment and try again.',
  stream_limited: 'Too many live views are open. Close one and try again.',
  submission_idempotency_conflict: 'A different task was already submitted from this form. Start a new task.',
  invalid_process_spec: 'Praxis rejected the task description.',
  unknown_executor: 'That executor is not available.',
  action_denied: 'You do not have access to this task.',
  process_not_found: 'That task no longer exists.',
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authenticatedRequest(`/api/praxis${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!response.ok) throw await failure(response);
  return response.json() as Promise<T>;
}

async function failure(response: Response): Promise<PraxisError> {
  const body = await response.json().catch(() => ({})) as { code?: string };
  const retry = Number(response.headers.get('Retry-After'));
  return new PraxisError(body.code || `http_${response.status}`, response.status, Number.isFinite(retry) && retry > 0 ? retry : undefined);
}

export const praxisApi = {
  status: () => call<PraxisStatus>('/status'),
  list: () => call<{ processes: Submission[] }>('/processes').then(result => result.processes),
  /** The key identifies one task form, so a retry after a lost response cannot create a second task. */
  submit: (task: { objective: string; executor: string; publish: boolean }, idempotencyKey: string) =>
    call<{ process_id: string; state: ProcessState; duplicate: boolean }>('/processes', {
      method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(task),
    }),
  inspect: (id: string) => call<ProcessView>(`/processes/${encodeURIComponent(id)}`),
  control: (id: string, operation: ControlOperation, attemptId: string) =>
    call<{ control: Record<string, unknown> }>(`/processes/${encodeURIComponent(id)}/control`, {
      method: 'POST', body: JSON.stringify({ operation, attemptId, policy: operation === 'cancel' ? 'tree' : 'self' }),
    }),
  approvals: (id: string) => call<{ approvals: Approval[] }>(`/processes/${encodeURIComponent(id)}/approvals`).then(r => r.approvals),
  decide: (id: string, approval: Approval, approved: boolean, reason: string) =>
    call(`/processes/${encodeURIComponent(id)}/approvals`, {
      method: 'POST',
      body: JSON.stringify({ effectId: approval.effect_id, version: approval.version, attemptId: approval.attempt_id, approved, reason }),
    }),
  publish: (id: string) =>
    call<{ publication: { status: 'accepted' | 'duplicate'; document_id?: string } }>(`/processes/${encodeURIComponent(id)}/publication`, { method: 'POST' }),
};

/**
 * Reads Server-Sent Events from a fetch body. EventSource cannot send the bearer
 * token, so the stream is parsed here. `onEvent` runs before the cursor advances:
 * the caller persists a cursor only for events it has handled.
 */
export async function readEventStream(body: ReadableStream<Uint8Array>,
  onFrame: (frame: { id?: string; event: string; data: string }) => void | Promise<void>): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let frame: { id?: string; event: string; data: string[] } = { event: 'message', data: [] };
  for (;;) {
    const { value, done } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.search(/\r?\n/)) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + (buffer[newline] === '\r' ? 2 : 1));
      if (line === '') {
        if (frame.data.length) await onFrame({ id: frame.id, event: frame.event, data: frame.data.join('\n') });
        frame = { event: 'message', data: [] };
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      const text = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'data') frame.data.push(text);
      else if (field === 'event') frame.event = text;
      else if (field === 'id') frame.id = text;
    }
    if (done) return;
  }
}

/**
 * Follows a process's events until it finishes, reconnecting with the last handled
 * cursor after an interruption. Resolves when the process has finished.
 */
export async function followEvents(id: string, options: {
  after: number; signal: AbortSignal; onEvent: (event: PraxisEvent) => void; onReconnect?: (error: unknown) => void;
}): Promise<number> {
  let cursor = options.after;
  for (let attempt = 0; !options.signal.aborted; attempt += 1) {
    let finished = false;
    try {
      const response = await authenticatedRequest(`/api/praxis/processes/${encodeURIComponent(id)}/events`, {
        // JSON too, so a refusal (429 stream_limited, 404) arrives as a readable error body.
        headers: { Accept: 'text/event-stream, application/json', ...(cursor > 0 ? { 'Last-Event-ID': String(cursor) } : {}) },
        signal: options.signal,
      });
      if (!response.ok || !response.body) throw await failure(response);
      attempt = 0;
      await readEventStream(response.body, frame => {
        if (frame.event === 'end') { finished = true; return; }
        if (frame.event === 'error') throw new PraxisError('praxis_stream_interrupted', 502);
        if (frame.event !== 'praxis') return;
        const event = JSON.parse(frame.data) as PraxisEvent;
        if (typeof event.cursor !== 'number' || event.cursor <= cursor) return;
        options.onEvent(event);
        cursor = event.cursor; // only after the event was handled
      });
      if (finished) return cursor;
    } catch (error) {
      if (options.signal.aborted) break;
      if (error instanceof PraxisError && error.status >= 400 && error.status < 500 && error.status !== 429) throw error;
      options.onReconnect?.(error);
    }
    const retryAfter = 1000 * Math.min(30, 2 ** Math.min(attempt, 5));
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, retryAfter);
      options.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }
  return cursor;
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../../services/authenticatedRequest', () => ({ authenticatedRequest: request }));

import { followEvents, praxisApi, PraxisError, readEventStream } from '../praxisApi';

function stream(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

const frame = (cursor: number, type: string) =>
  `id: ${cursor}\nevent: praxis\ndata: ${JSON.stringify({ cursor, event: { event_id: `e${cursor}`, process_id: 'p-1', type, payload: {} } })}\n\n`;

beforeEach(() => request.mockReset());

describe('readEventStream', () => {
  it('reassembles frames split across chunks and skips comments', async () => {
    const frames: Array<{ id?: string; event: string; data: string }> = [];
    const text = `: hello\n\n${frame(3, 'process.created')}${frame(7, 'process.completed')}`;
    await readEventStream(stream(text.slice(0, 17), text.slice(17, 60), text.slice(60)), f => { frames.push(f); });
    expect(frames.map(f => [f.id, f.event])).toEqual([['3', 'praxis'], ['7', 'praxis']]);
    expect(JSON.parse(frames[1].data).event.type).toBe('process.completed');
  });
});

describe('followEvents', () => {
  it('resumes with Last-Event-ID after an interruption and advances the cursor only after handling', async () => {
    vi.useFakeTimers();
    request
      .mockResolvedValueOnce(new Response(stream(frame(3, 'process.created')), { status: 200 }))
      .mockResolvedValueOnce(new Response(stream(frame(3, 'process.created'), frame(5, 'process.completed'), 'event: end\ndata: {}\n\n'), { status: 200 }));
    const seen: number[] = [];
    const abort = new AbortController();
    const done = followEvents('p-1', { after: 0, signal: abort.signal, onEvent: event => { seen.push(event.cursor); } });
    await vi.runAllTimersAsync();

    await expect(done).resolves.toBe(5);
    expect(seen).toEqual([3, 5]); // the replayed cursor 3 is not handled twice
    const secondHeaders = request.mock.calls[1][1].headers as Record<string, string>;
    expect(secondHeaders['Last-Event-ID']).toBe('3');
    vi.useRealTimers();
  });

  it('stops on a client error instead of retrying forever', async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'action_denied' }), { status: 403 }));
    await expect(followEvents('p-1', { after: 0, signal: new AbortController().signal, onEvent: () => {} }))
      .rejects.toMatchObject({ code: 'action_denied', status: 403 });
  });
});

describe('praxisApi', () => {
  it('sends the form idempotency key and never an identity of its own', async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ process_id: 'p-1', state: 'pending', duplicate: false }), { status: 202 }));
    await praxisApi.submit({ objective: 'Summarize', executor: 'fake', publish: true }, 'modulo-key-1');
    const [path, init] = request.mock.calls[0];
    expect(path).toBe('/api/praxis/processes');
    expect(init.headers['Idempotency-Key']).toBe('modulo-key-1');
    expect(JSON.parse(init.body)).toEqual({ objective: 'Summarize', executor: 'fake', publish: true });
    expect(JSON.stringify(init)).not.toContain('On-Behalf-Of');
  });

  it('turns server codes into readable errors with the Retry-After hint', async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'rate_limited' }), { status: 429, headers: { 'Retry-After': '9' } }));
    const error = await praxisApi.publish('p-1').catch(reason => reason) as PraxisError;
    expect(error).toBeInstanceOf(PraxisError);
    expect(error.retryAfter).toBe(9);
    expect(error.message).toMatch(/Too many requests/);
  });
});

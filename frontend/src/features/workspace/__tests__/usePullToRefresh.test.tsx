import { act, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { usePullToRefresh } from '../mobile/usePullToRefresh';

function Harness({ onRefresh, enabled = true }: { onRefresh: () => Promise<unknown>; enabled?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const pull = usePullToRefresh(host, onRefresh, enabled);
  return (
    <div ref={host} data-testid="host">
      <div data-testid="scroller">content</div>
      <span data-testid="state">{pull.refreshing ? 'refreshing' : `idle:${Math.round(pull.progress * 100)}`}</span>
    </div>
  );
}

/** jsdom has no PointerEvent; the hook only reads the fields below. */
function pointer(type: string, init: { clientX: number; clientY: number; pointerType?: string }) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType: 'touch', ...init });
  return event as PointerEvent;
}

async function pull(target: HTMLElement, distance: number) {
  await act(async () => {
    target.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 20 }));
    target.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 20 + distance }));
    target.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 20 + distance }));
  });
}

describe('usePullToRefresh', () => {
  it('refreshes when the pull passes the trigger distance', async () => {
    const onRefresh = vi.fn(async () => {});
    render(<Harness onRefresh={onRefresh} />);

    // Travel is halved by the resistance curve, so 200px of finger is well past
    // the 72px trigger.
    await pull(screen.getByTestId('scroller'), 200);
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });

  it('ignores a short tug, so a list does not resync on every scroll', async () => {
    const onRefresh = vi.fn(async () => {});
    render(<Harness onRefresh={onRefresh} />);

    await pull(screen.getByTestId('scroller'), 40);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('idle:0'));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores an upward drag and a mostly sideways one', async () => {
    const onRefresh = vi.fn(async () => {});
    render(<Harness onRefresh={onRefresh} />);
    const scroller = screen.getByTestId('scroller');

    await act(async () => {
      scroller.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 300 }));
      scroller.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 60 }));
      scroller.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 60 }));

      // A tab strip swipe: far more horizontal than vertical.
      scroller.dispatchEvent(pointer('pointerdown', { clientX: 300, clientY: 20 }));
      scroller.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 60 }));
      scroller.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 60 }));
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does nothing on a desktop pointer', async () => {
    const onRefresh = vi.fn(async () => {});
    render(<Harness onRefresh={onRefresh} enabled={false} />);

    await pull(screen.getByTestId('scroller'), 200);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('reports itself as refreshing until the work settles', async () => {
    let release = () => {};
    const onRefresh = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    render(<Harness onRefresh={onRefresh} />);

    await pull(screen.getByTestId('scroller'), 200);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('refreshing'));

    await act(async () => { release(); });
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('idle:0'));
  });
});

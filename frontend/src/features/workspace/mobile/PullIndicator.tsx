import { RefreshCw } from 'lucide-react';
import { cn } from '@/ui';
import type { PullToRefreshState } from './usePullToRefresh';

/**
 * Material's pull-to-refresh puck: a circle that descends from under the app
 * bar as you pull, rotates with the pull, and spins while the refresh runs.
 *
 * Drawn as an overlay rather than as a row in the layout so that pulling never
 * reflows the view underneath it.
 */
export function PullIndicator({ progress, refreshing }: PullToRefreshState) {
  const active = refreshing || progress > 0;
  return (
    <div
      aria-hidden={!refreshing}
      role={refreshing ? 'status' : undefined}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center md:hidden"
      style={{
        transform: `translateY(${active ? 8 + progress * 28 : -40}px)`,
        opacity: active ? Math.max(0.35, progress) : 0,
        transition: refreshing || !progress ? 'transform 0.2s ease, opacity 0.2s ease' : 'none',
      }}
    >
      <span className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-2 shadow-md">
        <RefreshCw
          className={cn('size-4 text-primary', refreshing && 'animate-spin')}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
          aria-hidden="true"
        />
      </span>
      {refreshing && <span className="sr-only">Refreshing</span>}
    </div>
  );
}

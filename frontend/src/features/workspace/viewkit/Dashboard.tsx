import { type ComponentType, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/ui';
import { EmptyPanel } from './EmptyPanel';
import { HealthLine, HealthList } from './Health';

/**
 * Panel grid for a dashboard.
 *
 * `auto-rows-min` is the point: panels size to their own content instead of
 * stretching to the tallest in the row, which is what left short panels
 * floating in a void. Dense flow lets a wide panel and two short ones pack
 * together rather than leaving a hole.
 */
export function DashboardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid auto-rows-min grid-flow-row-dense items-start gap-3 phone:gap-2.5 md:grid-cols-2 xl:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface HealthCheck {
  okay: boolean;
  message: ReactNode;
  /** Resolves the problem. Only rendered for failing checks. */
  action?: ReactNode;
}

/**
 * Health checks, with the passing ones collapsed.
 *
 * A panel of green ticks carries no information and cost as much space as the
 * work itself. Failures are listed; everything passing collapses to one line,
 * and an all-clear panel becomes a single sentence.
 */
export function HealthSummary({ checks, allClear }: { checks: HealthCheck[]; allClear?: string }) {
  const failing = checks.filter((check) => !check.okay);
  const passed = checks.length - failing.length;

  if (failing.length === 0) {
    return (
      <p className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
        {allClear ?? `All ${checks.length} checks passing.`}
      </p>
    );
  }

  return (
    <>
      <HealthList>
        {failing.map((check, index) => (
          <HealthLine key={index} okay={false} action={check.action}>
            {check.message}
          </HealthLine>
        ))}
      </HealthList>
      {passed > 0 && (
        <p className="mt-1.5 border-t border-border pt-1.5 text-xxs text-muted-foreground">
          {passed} other {passed === 1 ? 'check is' : 'checks are'} passing.
        </p>
      )}
    </>
  );
}

/**
 * Zero state for a whole dashboard.
 *
 * Without this a dashboard with no records renders its full scaffold as rows of
 * zeros and empty meters, which reads as broken rather than as empty.
 */
export function DashboardEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <EmptyPanel icon={icon} size="page" title={title} description={description} action={action} />;
}

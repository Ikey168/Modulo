import { type ComponentType, type ReactNode } from 'react';
import { cn } from '@/ui';

export interface ViewShellProps {
  /** Screen title. Rendered as the view's `h2` — every view needs exactly one. */
  title: string;
  /** One-line description shown under the title. */
  subtitle?: ReactNode;
  /** Lucide icon component for the title row. */
  icon?: ComponentType<{ className?: string }>;
  /** Primary/secondary controls, right-aligned in the header. */
  actions?: ReactNode;
  /** Optional toolbar row (search, filters) rendered below the title row. */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Override padding on the body. Defaults to the hub-tab `p-4`. */
  bodyClassName?: string;
}

/**
 * The standard workspace view scaffold.
 *
 * The host (`Workspace` / `HubView`) hands a view an `overflow-hidden` flex box
 * with no padding, so every view must supply its own scroll container, header
 * and padding. Before this component that boilerplate was copy-pasted into 37
 * files and had drifted into eight private `Shell` implementations. Use this
 * instead — it is the only sanctioned way to open a view.
 */
export function ViewShell({
  title,
  subtitle,
  icon: Icon,
  actions,
  toolbar,
  children,
  bodyClassName,
}: ViewShellProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      {/* Sticky on a phone: the screen's title says where you are, and its
          actions are often the only way to add a record — scrolling a long
          list must not strand either off the top. */}
      <header className="z-10 border-b border-border bg-background px-5 py-4 phone:sticky phone:top-0 phone:px-4 phone:py-3">
        <div className="flex flex-wrap items-center gap-3 phone:gap-2">
          <div className="min-w-0 flex-1">
            {/* On a phone the app bar is one line above and already says
                this, so the heading stays in the accessibility tree and gives
                its 40px back to the content. */}
            <h2 className="flex items-center gap-2 text-lg font-semibold phone:sr-only">
              {Icon && <Icon className="size-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />}
              <span className="truncate">{title}</span>
            </h2>
            {/* A wrapped three-line subtitle costs a phone a third of the
                fold, so it clamps to one line and the full text stays in the
                title attribute. */}
            {subtitle && (
              <p className="mt-1 text-[13px] text-muted-foreground phone:mt-0 phone:line-clamp-1" title={typeof subtitle === 'string' ? subtitle : undefined}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {toolbar && <div className="mt-3 flex flex-wrap items-center gap-2 phone:mt-2.5">{toolbar}</div>}
      </header>
      <div className={cn('p-5 phone:p-3', bodyClassName)}>{children}</div>
    </div>
  );
}

/**
 * Two-column body: primary content plus a right-hand rail that collapses above
 * the content below `xl`. Replaces the ad-hoc
 * `xl:grid-cols-[minmax(0,1fr)_auto]` grids that dedicated a whole column to a
 * single "Add" button.
 */
export function ViewColumns({
  children,
  rail,
  className,
}: {
  children: ReactNode;
  rail?: ReactNode;
  className?: string;
}) {
  if (!rail) return <div className={cn('min-w-0', className)}>{children}</div>;
  return (
    <div
      className={cn('grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]', className)}
    >
      <div className="order-2 min-w-0 xl:order-1">{children}</div>
      <div className="order-1 min-w-0 xl:order-2">{rail}</div>
    </div>
  );
}

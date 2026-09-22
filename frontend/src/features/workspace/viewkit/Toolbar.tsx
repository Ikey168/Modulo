import { type ReactNode } from 'react';
import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Button, Input, cn } from '@/ui';

/** Search box with the inset icon, matching the Marketplace/Notes treatment. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name. Defaults to the placeholder. */
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const clear = () => {
    onChange('');
    inputRef.current?.focus();
  };
  return (
    <div className={cn('relative min-w-0 flex-1 sm:max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground coarse:left-3 coarse:size-4"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        onKeyDown={(event) => {
          if (
            event.key === 'Escape' &&
            value &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            event.stopPropagation();
            clear();
          }
        }}
        className="h-8 pl-8 pr-8 text-xs coarse:h-10 coarse:pl-9 coarse:text-[15px] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="absolute right-0 top-0 h-8 w-8 coarse:h-10 coarse:w-10"
          aria-label={`Clear ${label ?? placeholder}`}
          onClick={clear}
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export interface FilterChipsProps<T extends string> {
  /** Accessible name for the group, e.g. "Filter tasks". */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; count?: number }[];
  className?: string;
}

/**
 * Compact tab row with real toggle semantics. The hand-rolled versions were bare
 * `<button>`s with no `type`, no `aria-pressed` and raw lowercase enum labels.
 */
export function FilterChips<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: FilterChipsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex flex-wrap items-center gap-1.5',
        // Six filters wrap to three rows on a 360dp screen and push the list
        // itself below the fold; one swipeable row keeps them all reachable.
        'coarse:scroll-strip coarse:flex-nowrap coarse:gap-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'border-b-2 border-x-0 border-t-0 px-2 py-1 text-xs transition-colors',
              'coarse:min-h-touch coarse:shrink-0 coarse:snap-start coarse:px-3 coarse:text-[13px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="ml-1 tabular-nums text-muted-foreground">
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Header control row: search and filters left, primary action pushed right. */
export function Toolbar({
  children,
  actions,
}: {
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {children}
      {actions && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

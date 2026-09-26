import { ExternalLink } from 'lucide-react';
import { cn } from '@/ui';

/** Absolute http(s) URLs only — everything else renders as plain text. */
function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Renders a captured URL as an actual link.
 *
 * These screens collected `url`, `datasheet`, `repository` and `sourceUrl`
 * fields and rendered every one of them as inert text — one file even styled
 * them `text-primary` inside a `<p>`, so they looked like links and were not.
 */
export function LinkOut({
  url,
  label,
  className,
}: {
  url: string | undefined;
  label?: string;
  className?: string;
}) {
  if (!url?.trim()) return null;
  const href = safeHref(url);
  const text = label ?? url.trim().replace(/^https?:\/\//, '');
  if (!href) {
    return <span className={cn('truncate text-xs text-muted-foreground', className)}>{text}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'inline-flex min-w-0 items-center gap-1 truncate text-xs text-primary hover:underline',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <span className="truncate">{text}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

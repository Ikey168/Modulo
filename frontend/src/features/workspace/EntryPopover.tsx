import { Children, cloneElement, isValidElement, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Popover, PopoverContent, PopoverTrigger, ScrollArea, cn } from '@/ui';

/** Shared large entry popover. Collection context stays visible behind it;
 * closing returns to the exact filters and scroll position the user had. */
export function EntryPopover({ open, onOpenChange, title, description, className, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent hideClose className={cn('block max-h-[88vh] max-w-5xl overflow-hidden p-0', className)}><DialogTitle className="sr-only">{title}</DialogTitle>{description && <DialogDescription className="sr-only">{description}</DialogDescription>}{children}</DialogContent></Dialog>;
}

export function EntryPopoverBody({ className, children }: { className?: string; children: ReactNode }) {
  return <ScrollArea className={cn('max-h-[calc(88vh-3.5rem)]', className)}>{children}</ScrollArea>;
}

/** Anchored quick-create surface used by collection plugins. It keeps creation
 * out of the permanent layout while remaining one click away. */
export function PopoverEditor({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  const items = Children.toArray(children);
  const last = items.at(-1);
  const hasAction = isValidElement(last) && last.type === Button;
  const fields = hasAction ? items.slice(0, -1) : items;
  const action = hasAction
    ? cloneElement(last as ReactElement<{ className?: string }>, {
        className: cn((last.props as { className?: string }).className, 'w-auto'),
      })
    : null;

  return <Popover><PopoverTrigger asChild><Button size="sm"><Plus/> {title}</Button></PopoverTrigger><PopoverContent align="end" sideOffset={8} className={cn('max-h-[82vh] w-[min(94vw,680px)] max-w-none overflow-y-auto p-0 shadow-sm', className)}><header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-popover px-4 py-3"><Plus className="size-4 shrink-0 text-primary"/><h3 className="min-w-0 text-sm font-semibold">{title}</h3>{description && <p className="sr-only">{description}</p>}</header><div className="grid min-w-0 gap-3 px-4 py-3">{fields}</div>{action && <footer className="flex justify-end border-t border-border px-4 py-3">{action}</footer>}</PopoverContent></Popover>;
}

/** Makes an existing summary card open into an overlay without intercepting
 * checkboxes, links, menus, or buttons placed on the card. */
export function EntryPreviewCard({ title = 'Entry details', description, className, children }: { title?: string; description?: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select, [role="button"], [role="checkbox"]')) return;
    setOpen(true);
  };
  return <>
    <article role="button" tabIndex={0} onClick={show} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setOpen(true); }} className={cn('cursor-pointer border-b border-border px-3 py-2.5 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>{children}</article>
    <EntryPopover open={open} onOpenChange={setOpen} title={title} description={description} className="max-w-3xl">
      <header className="border-b border-border px-4 py-2.5"><p className="text-sm font-semibold">{title}</p>{description && <p className="sr-only">{description}</p>}</header>
      <EntryPopoverBody><div className="space-y-4 p-5">{children}</div></EntryPopoverBody>
    </EntryPopover>
  </>;
}

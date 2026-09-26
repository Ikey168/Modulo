import { type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  buttonVariants,
  cn,
} from '@/ui';

export interface ConfirmDeleteProps {
  /** Name of the record being removed. Used in the accessible name and the confirm copy. */
  itemName: string;
  /** What the record is, e.g. "campaign". Keeps the prompt specific. */
  itemLabel?: string;
  onDelete: () => void;
  /**
   * Spell out anything the delete takes with it. These stores cascade — removing
   * a habit also drops its check-ins and streak — and that was previously
   * invisible until after the click.
   */
  consequence?: ReactNode;
  className?: string;
  size?: 'icon' | 'icon-sm';
}

/**
 * Destructive delete with a confirmation step and a real accessible name.
 *
 * Before this, deletes across the plugin screens were unnamed icon buttons
 * (`<Button size="icon"><Trash2/></Button>`) that fired immediately, several of
 * them cascading into child records. Screen readers announced only "button",
 * and there was no undo.
 */
export function ConfirmDelete({
  itemName,
  itemLabel = 'item',
  onDelete,
  consequence,
  className,
  size = 'icon-sm',
}: ConfirmDeleteProps) {
  const label = itemName.trim() || `Untitled ${itemLabel}`;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={size}
          aria-label={`Delete ${itemLabel} ${label}`}
          className={cn('text-muted-foreground hover:bg-destructive/10 hover:text-destructive', className)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {consequence ? <>{consequence} </> : null}
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={onDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

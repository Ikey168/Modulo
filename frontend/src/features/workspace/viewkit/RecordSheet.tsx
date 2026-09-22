import { useRef, useState, type ReactNode } from 'react';
import { Pencil, X } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  cn,
} from '@/ui';
import { workspaceStorageFailureRevision } from '../workspaceStorage';

export interface FactProps {
  label: string;
  value: ReactNode;
  /** Rendered when `value` is empty, so an unset field still reads as unset. */
  placeholder?: string;
  /** Spans both columns — use for summaries and notes. */
  wide?: boolean;
  /** Draws the eye to the field the screen is actually about. */
  emphasis?: boolean;
}

/** One label/value pair in a read view. */
export function Fact({
  label,
  value,
  placeholder = 'Not set',
  wide,
  emphasis,
}: FactProps) {
  const empty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);
  return (
    <div
      className={cn(
        'min-w-0 border-b border-border px-1 py-2.5',
        wide && 'sm:col-span-2',
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className={cn(
          'mt-1 break-words text-[13px]',
          emphasis && !empty && 'font-medium text-foreground',
          empty && 'text-muted-foreground',
        )}
      >
        {empty ? placeholder : value}
      </div>
    </div>
  );
}

/** Two-column grid of `Fact`s. */
export function FactGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)}>{children}</div>
  );
}

export interface RecordSheetProps<T> {
  /** The open record, or `null` when the sheet is closed. */
  record: T | null;
  onClose: () => void;
  title: string;
  /** Short form title shown while editing; defaults to the read-view title. */
  editTitle?: string;
  subtitle?: ReactNode;
  /** Status pills shown beside the title. */
  badges?: ReactNode;
  /** Read view. Typically a `FactGrid`. */
  children: ReactNode;
  /**
   * Edit form, given a working draft. Supplying this is what gives a screen an
   * edit path — most of these views could only create and delete, so a typo in
   * a record was unfixable except by deleting and retyping it.
   */
  renderEdit?: (draft: T, setDraft: (next: T) => void) => ReactNode;
  /** Return false or reject to keep the draft open after a failed save. */
  onSave?: (draft: T) => void | boolean | Promise<void | boolean>;
  /** Footer actions, e.g. `ConfirmDelete`. */
  actions?: ReactNode;
  /** Optional sizing or layout overrides for screens with wider edit forms. */
  contentClassName?: string;
}

/**
 * Record detail overlay with a read view and an explicit edit affordance.
 *
 * Replaces `EntryPreviewCard`'s no-op popover, which rendered the same summary
 * children in the card and again in the modal under the generic heading "Entry
 * details", so opening a record showed you nothing new.
 */
export function RecordSheet<T>({
  record,
  onClose,
  title,
  editTitle,
  subtitle,
  badges,
  children,
  renderEdit,
  onSave,
  actions,
  contentClassName,
}: RecordSheetProps<T>) {
  const [busy, setBusy] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open={record !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
    >
      {/* On a phone `dialog-sheet` (styles/index.css) docks this to the bottom
          edge; the desktop sizing below still applies from `sm` up. */}
      <DialogContent
        ref={contentRef}
        className={cn(
          'max-h-[85vh] w-[min(94vw,560px)] max-w-none overflow-y-auto',
          contentClassName,
        )}
      >
        {record !== null && (
          <RecordSheetBody
            key={
              typeof record === 'object' && record && 'id' in record
                ? String(record.id)
                : undefined
            }
            record={record}
            onSavingChange={setBusy}
            onStartEdit={() => { if (contentRef.current) contentRef.current.scrollTop = 0; }}
            title={title}
            editTitle={editTitle}
            subtitle={subtitle}
            badges={badges}
            renderEdit={renderEdit}
            onSave={onSave}
            actions={actions}
            onClose={onClose}
          >
            {children}
          </RecordSheetBody>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecordSheetBody<T>({
  record,
  title,
  editTitle,
  subtitle,
  badges,
  children,
  renderEdit,
  onSave,
  actions,
  onClose,
  onSavingChange,
  onStartEdit,
}: RecordSheetProps<T> & {
  record: T;
  onSavingChange: (saving: boolean) => void;
  onStartEdit: () => void;
}) {
  const [draft, setDraft] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const editing = draft !== null;

  const save = async () => {
    if (draft === null || !onSave || savingRef.current) return;
    savingRef.current = true;
    onSavingChange(true);
    setSaving(true);
    setError('');
    const failureRevision = workspaceStorageFailureRevision();
    try {
      const result = await onSave(draft);
      // Older screen callbacks return void after writing; honor their storage result too.
      if (
        result === false ||
        workspaceStorageFailureRevision() !== failureRevision
      ) {
        setError(
          'Couldn’t save changes. Your draft is still here; try saving again.',
        );
      } else setDraft(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Couldn’t save changes. Try again.',
      );
    } finally {
      savingRef.current = false;
      onSavingChange(false);
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      onKeyDown={(event) => {
        if (
          editing &&
          !event.nativeEvent.isComposing &&
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          event.key === 'Enter'
        ) {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
          <span className="min-w-0 break-words">{editing && editTitle ? editTitle : title}</span>
          {!editing && badges}
        </DialogTitle>
        {!editing && subtitle && <DialogDescription>{subtitle}</DialogDescription>}
      </DialogHeader>

      {editing ? (
        <fieldset disabled={saving} className="grid min-w-0 gap-3">
          {renderEdit?.(draft, setDraft)}
        </fieldset>
      ) : (
        children
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {/* Sticky on a phone: Save must not be at the far end of a long form's
          scroll, and the sheet's own bottom padding already clears the
          gesture bar. */}
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-3 phone:sticky phone:bottom-0 phone:-mx-4 phone:-mb-1 phone:bg-popover phone:px-4 phone:pb-1">
        {editing ? (
          <>
            <Button key="save" type="submit" size="sm" className="coarse:h-11 coarse:flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="coarse:h-11"
              disabled={saving}
              onClick={() => {
                setDraft(null);
                setError('');
              }}
            >
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          </>
        ) : (
          <>
            {renderEdit && onSave && (
              <Button
                key="edit"
                type="button"
                size="sm"
                variant="outline"
                className="coarse:h-11 coarse:flex-1"
                onClick={() => {
                  onStartEdit();
                  setDraft(record);
                  setError('');
                }}
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" className="coarse:h-11" onClick={onClose}>
              Close
            </Button>
          </>
        )}
        {!editing && actions && (
          <span className="ml-auto flex items-center gap-1">{actions}</span>
        )}
      </div>
    </form>
  );
}

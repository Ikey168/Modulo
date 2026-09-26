import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  AlignLeft,
  CalendarDays,
  CircleDollarSign,
  CircleDot,
  Hash,
  Link2,
  SlidersHorizontal,
  Tag,
  Type,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/ui';

export interface FieldProps {
  /** Visible label. Required — an unlabelled control is the single most common defect in these screens. */
  label: string;
  children: ReactNode;
  /** Short helper text under the control. */
  hint?: ReactNode;
  className?: string;
  /** Inspector rows are compact; stacked fields suit full edit forms. */
  layout?: 'inspector' | 'stacked';
}

function propertyVisual(label: string): { icon: LucideIcon; tone: string } {
  const value = label.toLocaleLowerCase();
  if (/status|stage|state|priority/.test(value))
    return { icon: CircleDot, tone: 'text-success' };
  if (
    /date|due|start|end|schedule|repeat|cadence|block|review|renewal/.test(
      value,
    )
  )
    return { icon: CalendarDays, tone: 'text-info' };
  if (/amount|currency|cost|price|budget|rate|payment/.test(value))
    return { icon: CircleDollarSign, tone: 'text-warning' };
  if (/category|type|mode|kind|layer|tag|recipe|meal|food/.test(value))
    return { icon: Tag, tone: 'text-warning' };
  if (/url|link|repository|source/.test(value))
    return { icon: Link2, tone: 'text-primary' };
  if (
    /author|creator|person|people|client|provider|vendor|owner|contact|gm/.test(
      value,
    )
  )
    return { icon: UserRound, tone: 'text-success' };
  if (
    /note|body|description|reason|purpose|outcome|summary|instruction|definition/.test(
      value,
    )
  )
    return { icon: AlignLeft, tone: 'text-muted-foreground' };
  if (/title|name|subject|activity|project|goal/.test(value))
    return { icon: Type, tone: 'text-primary' };
  if (/minute|duration|quantity|serving|progress|rating|revision/.test(value))
    return { icon: Hash, tone: 'text-info' };
  return { icon: SlidersHorizontal, tone: 'text-muted-foreground' };
}

export function PropertyGlyph({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const visual = propertyVisual(label);
  const Icon = visual.icon;
  return (
    <Icon
      aria-hidden="true"
      className={cn('size-4 shrink-0', visual.tone, className)}
    />
  );
}

/**
 * Label + control pair with the `htmlFor`/`id` wiring done for you.
 *
 * If the child is a single element without its own `id`, it is cloned with the
 * generated id so the label actually points at it. Replaces eleven private
 * `Field` copies, most of which rendered a label that was not associated with
 * anything.
 */
export function Field({ label, children, hint, className, layout = 'inspector' }: FieldProps) {
  const generatedId = useId();
  const childProps = isValidElement(children)
    ? (children.props as { id?: string; 'aria-describedby'?: string })
    : undefined;
  const id = childProps?.id || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const child = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{ id?: string; 'aria-describedby'?: string }>,
        {
          id,
          'aria-describedby':
            [childProps?.['aria-describedby'], hintId]
              .filter(Boolean)
              .join(' ') || undefined,
        },
      )
    : children;
  if (layout === 'stacked') {
    return (
      <div className={cn('grid min-w-0 content-start gap-1.5', className)}>
        <Label
          htmlFor={id}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
        >
          <PropertyGlyph label={label} className="size-3.5" />
          {label}
        </Label>
        <div className="min-w-0">{child}</div>
        {hint && (
          <p id={hintId} className="text-xxs leading-4 text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group -mx-2 grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] sm:grid-cols-[1.25rem_7.5rem_minmax(0,1fr)] items-start gap-x-2 border-b border-border/70 px-2 py-1.5 transition-colors hover:bg-muted/20',
        className,
      )}
    >
      <PropertyGlyph label={label} className="mt-2" />
      <Label
        htmlFor={id}
        className="pt-2 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground"
      >
        {label}
      </Label>
      <div className="col-span-2 min-w-0 sm:col-span-1 [&_input]:border-transparent [&_input]:bg-transparent [&_input]:shadow-none [&_input]:hover:bg-surface-2/70 [&_input]:focus-visible:border-primary/60 [&_textarea]:border-transparent [&_textarea]:bg-transparent [&_textarea]:shadow-none [&_textarea]:hover:bg-surface-2/70 [&_textarea]:focus-visible:border-primary/60 [&_[role=combobox]]:border-transparent [&_[role=combobox]]:bg-transparent [&_[role=combobox]]:shadow-none [&_[role=combobox]]:hover:bg-surface-2/70 [&_[role=combobox]]:focus-visible:border-primary/60">
        {child}
      </div>
      {hint && (
        <p
          id={hintId}
          className="col-span-2 mt-1 sm:col-span-1 sm:col-start-3 text-xxs text-muted-foreground"
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/** Groups related properties in an inspector-style section. */
export function FieldGroup({
  legend,
  children,
  className,
  contentClassName,
  columns = 2,
}: {
  legend: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  columns?: 1 | 2;
}) {
  return (
    <fieldset className={cn('min-w-0 border-t border-border pt-2', className)}>
      <legend className="pr-2 text-xs font-medium text-primary">
        {legend}
      </legend>
      <div className={cn('grid gap-x-4 gap-y-1', columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1', contentClassName)}>
        {children}
      </div>
    </fieldset>
  );
}

/** Sentinel for "no selection" — Radix forbids an empty-string item value. */
const NONE = '__none__';

export interface ChoiceOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ChoiceProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: readonly string[] | readonly ChoiceOption[];
  /** Adds a clearing option, so an assigned value can be unassigned. */
  clearable?: boolean;
  clearLabel?: string;
  placeholder?: string;
  hint?: ReactNode;
  className?: string;
  disabled?: boolean;
  layout?: FieldProps['layout'];
}

type ChoiceControlProps = Pick<
  ChoiceProps,
  | 'value'
  | 'onChange'
  | 'options'
  | 'clearable'
  | 'clearLabel'
  | 'placeholder'
  | 'disabled'
> & { id?: string };

/** The control half of Choice. Field injects `id`; this forwards it to the real trigger. */
function ChoiceControl({
  id,
  value,
  onChange,
  options,
  clearable = false,
  clearLabel = 'None',
  placeholder = 'Select…',
  disabled,
}: ChoiceControlProps) {
  const items: ChoiceOption[] = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );
  return (
    <Select
      value={value ? value : clearable ? NONE : undefined}
      onValueChange={(next) => onChange(next === NONE ? '' : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {clearable && (
          <SelectItem value={NONE} className="text-muted-foreground">
            {clearLabel}
          </SelectItem>
        )}
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            disabled={item.disabled}
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Labelled select built on the design-system `Select`.
 *
 * Replaces the raw `<select className={SELECT}>` pattern — the same style
 * constant was declared independently in sixteen files, and native selects do
 * not match the height, focus ring or dark-mode surface of the `Input` sitting
 * next to them.
 */
export function Choice({
  label,
  value,
  onChange,
  options,
  clearable = false,
  clearLabel = 'None',
  placeholder = 'Select…',
  hint,
  className,
  disabled,
  layout,
}: ChoiceProps) {
  return (
    <Field label={label} hint={hint} className={className} layout={layout}>
      <ChoiceControl
        value={value}
        onChange={onChange}
        options={options}
        clearable={clearable}
        clearLabel={clearLabel}
        placeholder={placeholder}
        disabled={disabled}
      />
    </Field>
  );
}

export interface ChoiceInlineProps extends Omit<ChoiceProps, 'label' | 'hint'> {
  /** Accessible name. There is no visible label, so this is the only one. */
  label: string;
  /** Static text rendered before the value, e.g. "Sort:". */
  prefix?: string;
}

/**
 * Compact select for toolbars, where a stacked visible label would break the
 * control row. Still carries a real accessible name — the toolbar selects this
 * replaces were unlabelled, and one shipped an empty `<Label>` element.
 */
export function ChoiceInline({
  label,
  value,
  onChange,
  options,
  clearable = false,
  clearLabel = 'All',
  placeholder = 'Select…',
  prefix,
  className,
  disabled,
}: ChoiceInlineProps) {
  const items: ChoiceOption[] = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );
  return (
    <Select
      value={value ? value : clearable ? NONE : undefined}
      onValueChange={(next) => onChange(next === NONE ? '' : next)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={label}
        className={cn('h-9 w-auto min-w-[10rem] gap-2 text-[13px]', className)}
      >
        <PropertyGlyph label={label} className="size-3.5" />
        {prefix && (
          <span className="shrink-0 text-muted-foreground">{prefix}</span>
        )}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {clearable && (
          <SelectItem value={NONE} className="text-muted-foreground">
            {clearLabel}
          </SelectItem>
        )}
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            disabled={item.disabled}
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

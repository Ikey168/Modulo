import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from './cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/** shadcn/ui Switch (Radix), with the project's `onChange(checked)` signature. */
export function Switch({ checked, onChange, disabled, id, className, ...aria }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors ' +
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
          'disabled:cursor-not-allowed disabled:opacity-50 ' +
          'data-[state=checked]:bg-primary data-[state=unchecked]:border-border-strong data-[state=unchecked]:bg-surface-3',
        className,
      )}
      {...aria}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform ' +
            'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from './cn';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** shadcn/ui Avatar (Radix), wrapped with the project's src/name/size API. */
export function Avatar({ src, name, size = 28, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', className)}
      style={{ width: size, height: size }}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name ?? 'avatar'} className="h-full w-full object-cover" />}
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center bg-primary/15 font-medium uppercase text-primary"
        style={{ fontSize: size * 0.4 }}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

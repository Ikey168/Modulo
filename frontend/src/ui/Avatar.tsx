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

/** Circular user avatar; falls back to initials on a tinted surface. */
export function Avatar({ src, name, size = 28, className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ' +
          'bg-primary/15 text-primary font-medium uppercase',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        <img src={src} alt={name ?? 'avatar'} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

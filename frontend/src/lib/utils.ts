import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's default scale; without this it reads the
 * custom `text-xxs` size as a text colour and drops the real colour class next
 * to it (which left the avatar initials in low-contrast grey).
 */
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['xxs'] }] } } });

/** Merge conditional class names with Tailwind conflict resolution (shadcn/ui `cn`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { expect, it } from 'vitest';
import { cn } from '../utils';

it('keeps a colour class next to the custom text-xxs size', () => {
  expect(cn('text-foreground', 'text-xxs')).toBe('text-foreground text-xxs');
  expect(cn('text-xs', 'text-xxs')).toBe('text-xxs');
});

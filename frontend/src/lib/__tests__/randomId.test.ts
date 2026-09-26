import { expect, it } from 'vitest';
import { randomId } from '../randomId';

it('makes lowercase base36 ids of the requested length without repeats', () => {
  const ids = new Set(Array.from({ length: 2000 }, () => randomId()));
  expect(ids.size).toBe(2000);
  for (const id of ids) expect(id).toMatch(/^[0-9a-z]{8}$/);
  expect(randomId(20)).toHaveLength(20);
});

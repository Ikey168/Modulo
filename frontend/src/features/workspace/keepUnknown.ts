/**
 * Carry fields this version does not know about through a parse, so an older
 * client saving a record never erases data written by a newer one. Known
 * fields always take the parsed (validated) value.
 */
export function keepUnknown<T extends object>(raw: Record<string, unknown>, parsed: T): T {
  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in parsed) && value !== undefined) unknown[key] = value;
  }
  return { ...unknown, ...parsed };
}

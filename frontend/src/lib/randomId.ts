const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Random record id suffix from the platform CSPRNG. Record ids end up in URLs,
 * cross-plugin links and sync keys, so they must not be predictable or collide
 * the way Math.random ids can.
 */
export function randomId(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = '';
  // 252 is the largest multiple of 36 below 256: rejecting above it keeps every character equally likely.
  for (let index = 0; id.length < length; index += 1) {
    if (index === bytes.length) { crypto.getRandomValues(bytes); index = 0; }
    if (bytes[index] < 252) id += ALPHABET[bytes[index] % 36];
  }
  return id;
}

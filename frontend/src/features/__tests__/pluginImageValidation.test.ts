import { describe, expect, it } from 'vitest';
import {
  IMAGE_DIGEST_PATTERN,
  KNOWN_PERMISSIONS,
  validateImageDigest,
  validateImageReference,
} from '../pluginImageValidation';

const VALID_DIGEST = `sha256:${'a1b2c3d4'.repeat(8)}`;

describe('validateImageDigest', () => {
  it('accepts "sha256:" followed by 64 lowercase hex characters', () => {
    expect(validateImageDigest(VALID_DIGEST)).toBeNull();
    expect(validateImageDigest(`sha256:${'0'.repeat(64)}`)).toBeNull();
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateImageDigest(`  ${VALID_DIGEST}  `)).toBeNull();
  });

  it('requires a value', () => {
    expect(validateImageDigest('')).toBe('Image digest is required');
    expect(validateImageDigest('   ')).toBe('Image digest is required');
  });

  it.each([
    ['missing prefix', 'a'.repeat(64)],
    ['wrong algorithm', `sha512:${'a'.repeat(64)}`],
    ['too short', `sha256:${'a'.repeat(63)}`],
    ['too long', `sha256:${'a'.repeat(65)}`],
    ['uppercase hex', `sha256:${'A'.repeat(64)}`],
    ['non-hex characters', `sha256:${'g'.repeat(64)}`],
  ])('rejects %s', (_label, digest) => {
    expect(validateImageDigest(digest)).toBe(
      'Digest must be "sha256:" followed by 64 lowercase hex characters',
    );
  });

  it('exposes the pattern used by the backend contract', () => {
    expect(IMAGE_DIGEST_PATTERN.test(VALID_DIGEST)).toBe(true);
    expect(IMAGE_DIGEST_PATTERN.test('sha256:nope')).toBe(false);
  });
});

describe('validateImageReference', () => {
  it.each([
    ['registry + org + repo', 'ghcr.io/acme/plugin'],
    ['registry + repo + tag', 'ghcr.io/acme/plugin:1.2.0'],
    ['deeply nested path', 'registry.example.com/team/sub/plugin'],
    ['registry with port', 'localhost:5000/acme/plugin'],
    ['docker-hub style without registry', 'acme/plugin'],
    ['single official-image style name', 'plugin'],
    ['name with separators', 'ghcr.io/acme/my_plugin-v2.beta'],
  ])('accepts %s', (_label, ref) => {
    expect(validateImageReference(ref)).toBeNull();
  });

  it('requires a value', () => {
    expect(validateImageReference('')).toBe('Image reference is required');
    expect(validateImageReference('   ')).toBe('Image reference is required');
  });

  it('rejects references that embed a digest (it belongs in the digest field)', () => {
    const message = 'Do not append a digest to the reference — enter it in the Image Digest field instead';
    expect(validateImageReference(`ghcr.io/acme/plugin@${'sha256:' + 'a'.repeat(64)}`)).toBe(message);
    expect(validateImageReference(`ghcr.io/acme/plugin:sha256:${'a'.repeat(64)}`)).toBe(message);
  });

  it('rejects uppercase references', () => {
    expect(validateImageReference('ghcr.io/Acme/plugin')).toBe('Image references must be lowercase');
  });

  it('rejects whitespace inside the reference', () => {
    expect(validateImageReference('ghcr.io/acme plugin')).toBe(
      'Image reference must not contain whitespace',
    );
  });

  it('rejects a bare registry with no repository path', () => {
    expect(validateImageReference('ghcr.io/')).toBe(
      'Enter a valid container image reference, e.g. ghcr.io/acme/plugin',
    );
    expect(validateImageReference('ghcr.io')).toBe(
      'Include a repository path after the registry, e.g. ghcr.io/acme/plugin',
    );
  });

  it.each([
    ['empty path segment', 'ghcr.io//plugin'],
    ['trailing slash', 'ghcr.io/acme/plugin/'],
    ['segment starting with separator', 'ghcr.io/acme/-plugin'],
    ['illegal characters', 'ghcr.io/acme/plug!n'],
  ])('rejects %s', (_label, ref) => {
    expect(validateImageReference(ref)).toBe(
      'Enter a valid container image reference, e.g. ghcr.io/acme/plugin',
    );
  });

  it('rejects malformed tags', () => {
    expect(validateImageReference('ghcr.io/acme/plugin:.bad')).toBe(
      'Tag may only contain letters, digits, ".", "_" and "-" (max 128 characters)',
    );
    expect(validateImageReference(`ghcr.io/acme/plugin:${'x'.repeat(129)}`)).not.toBeNull();
  });
});

describe('KNOWN_PERMISSIONS', () => {
  it('offers the marketplace permission catalogue', () => {
    expect(KNOWN_PERMISSIONS).toEqual([
      'notes.read',
      'notes.write',
      'notes.delete',
      'users.read',
      'system.events.publish',
      'system.events.subscribe',
    ]);
  });
});

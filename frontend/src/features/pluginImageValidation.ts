/**
 * Validators and constants for container-image plugin submissions (#395).
 *
 * Marketplace plugins are EXTERNAL-only: they are submitted as a container
 * image reference pinned to a sha256 digest, never as a JAR upload. These
 * helpers are exported separately from the wizard component so they can be
 * unit-tested in isolation.
 */

/** Exact shape the backend accepts for `imageDigest`. */
export const IMAGE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** Known marketplace plugin permissions offered in the submission wizard. */
export const KNOWN_PERMISSIONS = [
  'notes.read',
  'notes.write',
  'notes.delete',
  'users.read',
  'system.events.publish',
  'system.events.subscribe',
];

/** Registry host: "ghcr.io", "localhost:5000", "registry.example.com:443", … */
const REGISTRY_HOST_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*(?::\d{1,5})?$/;

/** One repository path component per the OCI distribution spec (lowercase only). */
const PATH_COMPONENT_PATTERN = /^[a-z0-9]+(?:(?:\.|_|__|-+)[a-z0-9]+)*$/;

/** Optional tag, e.g. ":1.2.0" — max 128 chars, cannot start with "." or "-". */
const TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

const REFERENCE_EXAMPLE_ERROR =
  'Enter a valid container image reference, e.g. ghcr.io/acme/plugin';

/**
 * Validates a container image repository reference (optionally with a tag).
 * Digests are deliberately rejected here — they belong in the separate
 * digest field so a reference can never carry a conflicting pin.
 *
 * @returns an error message, or `null` when the reference is valid.
 */
export function validateImageReference(value: string): string | null {
  const ref = value.trim();

  if (!ref) return 'Image reference is required';
  if (/\s/.test(ref)) return 'Image reference must not contain whitespace';
  if (ref.includes('@') || ref.toLowerCase().includes('sha256:')) {
    return 'Do not append a digest to the reference — enter it in the Image Digest field instead';
  }
  if (/[A-Z]/.test(ref)) return 'Image references must be lowercase';

  // Split an optional tag off the final path segment (a ":" after the last "/").
  const lastSlash = ref.lastIndexOf('/');
  const tagColon = ref.indexOf(':', lastSlash + 1);
  const name = tagColon === -1 ? ref : ref.slice(0, tagColon);
  const tag = tagColon === -1 ? null : ref.slice(tagColon + 1);

  const segments = name.split('/');
  if (segments.some((segment) => segment.length === 0)) return REFERENCE_EXAMPLE_ERROR;

  // The first segment is a registry host when it contains "." or ":" or is
  // "localhost" (same heuristic Docker uses); otherwise it is a repo path part.
  const [first] = segments;
  let pathSegments = segments;
  if (first.includes('.') || first.includes(':') || first === 'localhost') {
    if (!REGISTRY_HOST_PATTERN.test(first)) return REFERENCE_EXAMPLE_ERROR;
    pathSegments = segments.slice(1);
    if (pathSegments.length === 0) {
      return 'Include a repository path after the registry, e.g. ghcr.io/acme/plugin';
    }
  }

  if (!pathSegments.every((segment) => PATH_COMPONENT_PATTERN.test(segment))) {
    return REFERENCE_EXAMPLE_ERROR;
  }

  if (tag !== null && !TAG_PATTERN.test(tag)) {
    return 'Tag may only contain letters, digits, ".", "_" and "-" (max 128 characters)';
  }

  return null;
}

/**
 * Validates a sha256 image digest ("sha256:" + 64 lowercase hex chars).
 *
 * @returns an error message, or `null` when the digest is valid.
 */
export function validateImageDigest(value: string): string | null {
  const digest = value.trim();

  if (!digest) return 'Image digest is required';
  if (!IMAGE_DIGEST_PATTERN.test(digest)) {
    return 'Digest must be "sha256:" followed by 64 lowercase hex characters';
  }

  return null;
}

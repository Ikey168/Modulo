import { describe, it, expect } from 'vitest';
import { parseSemVer, compareSemVer } from '../pack/packManifest';

// SHA-256 integrity helper (pure TS re-implementation for test verification)
async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// CID validation matching IpfsService.isValidCid
function isValidCid(cid: string): boolean {
  if (!cid || !cid.trim()) return false;
  const t = cid.trim();
  return (t.startsWith('Qm') && t.length === 46) || (t.startsWith('b') && t.length > 50);
}

describe('CID validation', () => {
  it('accepts a valid CIDv0', () => {
    expect(isValidCid('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')).toBe(true);
  });

  it('accepts a valid CIDv1', () => {
    expect(isValidCid('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe(true);
  });

  it('rejects a short string', () => {
    expect(isValidCid('Qmbad')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidCid('')).toBe(false);
  });

  it('rejects a plain string', () => {
    expect(isValidCid('not-a-cid')).toBe(false);
  });
});

describe('SHA-256 integrity', () => {
  it('produces a 64-char hex digest', async () => {
    const h = await sha256Hex('{"id":"test","version":"1.0.0"}');
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', async () => {
    const a = await sha256Hex('hello');
    const b = await sha256Hex('hello');
    expect(a).toBe(b);
  });

  it('changes when content changes', async () => {
    const a = await sha256Hex('pack-a');
    const b = await sha256Hex('pack-b');
    expect(a).not.toBe(b);
  });
});

describe('semver utilities (used in pack versioning)', () => {
  it('parseSemVer returns numeric tuple', () => {
    expect(parseSemVer('2.3.4')).toEqual([2, 3, 4]);
  });

  it('compareSemVer respects major > minor > patch ordering', () => {
    expect(compareSemVer('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareSemVer('1.2.3', '1.2.4')).toBeLessThan(0);
    expect(compareSemVer('1.0.0', '1.0.0')).toBe(0);
  });
});

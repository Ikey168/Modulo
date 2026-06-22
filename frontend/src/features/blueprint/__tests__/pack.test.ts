import { describe, it, expect } from 'vitest';
import {
  parseSemVer,
  compareSemVer,
  satisfiesMin,
  validateManifest,
  checkCompatibility,
  checkDependencies,
  derivePackCapabilities,
  type PackManifest,
} from '../pack/packManifest';
import { NodeCatalog } from '../nodeCatalog';

const emptyCatalog = new NodeCatalog();

function minimalManifest(overrides: Partial<PackManifest> = {}): PackManifest {
  return {
    id: 'com.example.test-pack',
    version: '1.0.0',
    name: 'Test Pack',
    contributes: {},
    ...overrides,
  };
}

// ---- parseSemVer ----

describe('parseSemVer', () => {
  it('parses valid semver', () => {
    expect(parseSemVer('1.2.3')).toEqual([1, 2, 3]);
  });

  it('returns null for invalid strings', () => {
    expect(parseSemVer('1.2')).toBeNull();
    expect(parseSemVer('a.b.c')).toBeNull();
    expect(parseSemVer('')).toBeNull();
    expect(parseSemVer('1.2.3.4')).toBeNull();
  });
});

// ---- compareSemVer ----

describe('compareSemVer', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemVer('1.0.0', '1.0.0')).toBe(0);
  });

  it('correctly orders versions', () => {
    expect(compareSemVer('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareSemVer('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareSemVer('1.1.0', '1.0.9')).toBeGreaterThan(0);
  });

  it('throws on invalid semver', () => {
    expect(() => compareSemVer('bad', '1.0.0')).toThrow();
  });
});

// ---- satisfiesMin ----

describe('satisfiesMin', () => {
  it('returns true when version meets minimum', () => {
    expect(satisfiesMin('1.0.0', '1.0.0')).toBe(true);
    expect(satisfiesMin('2.0.0', '1.9.9')).toBe(true);
  });

  it('returns false when version is below minimum', () => {
    expect(satisfiesMin('1.0.0', '1.0.1')).toBe(false);
  });
});

// ---- validateManifest ----

describe('validateManifest', () => {
  it('accepts a valid minimal manifest', () => {
    expect(validateManifest(minimalManifest(), emptyCatalog).ok).toBe(true);
  });

  it('rejects missing id', () => {
    const r = validateManifest(minimalManifest({ id: '' }), emptyCatalog);
    expect(r.ok).toBe(false);
  });

  it('rejects invalid version', () => {
    const r = validateManifest(minimalManifest({ version: 'bad' }), emptyCatalog);
    expect(r.ok).toBe(false);
  });

  it('rejects invalid minCatalogVersion', () => {
    const r = validateManifest(minimalManifest({ minCatalogVersion: 'x.y' }), emptyCatalog);
    expect(r.ok).toBe(false);
  });

  it('rejects dependency with invalid minVersion', () => {
    const r = validateManifest(
      minimalManifest({ dependencies: [{ id: 'other', minVersion: 'nope' }] }),
      emptyCatalog,
    );
    expect(r.ok).toBe(false);
  });
});

// ---- checkCompatibility ----

describe('checkCompatibility', () => {
  it('passes when catalog meets minCatalogVersion', () => {
    const r = checkCompatibility(
      minimalManifest({ minCatalogVersion: '1.0.0' }),
      { version: '1.0.0' },
      1,
    );
    expect(r.ok).toBe(true);
  });

  it('fails when catalog is too old', () => {
    const r = checkCompatibility(
      minimalManifest({ minCatalogVersion: '2.0.0' }),
      { version: '1.9.9' },
      1,
    );
    expect(r.ok).toBe(false);
  });

  it('fails when IR version is too old', () => {
    const r = checkCompatibility(minimalManifest({ minIrVersion: 5 }), { version: '2.0.0' }, 1);
    expect(r.ok).toBe(false);
  });
});

// ---- checkDependencies ----

describe('checkDependencies', () => {
  it('passes when all dependencies are installed', () => {
    const installed = new Map([['dep.pack', '2.0.0']]);
    const r = checkDependencies(
      minimalManifest({ dependencies: [{ id: 'dep.pack', minVersion: '1.0.0' }] }),
      installed,
    );
    expect(r.ok).toBe(true);
  });

  it('fails when a dependency is missing', () => {
    const r = checkDependencies(
      minimalManifest({ dependencies: [{ id: 'missing.pack', minVersion: '1.0.0' }] }),
      new Map(),
    );
    expect(r.ok).toBe(false);
  });

  it('fails when installed version is too old', () => {
    const installed = new Map([['dep.pack', '0.9.0']]);
    const r = checkDependencies(
      minimalManifest({ dependencies: [{ id: 'dep.pack', minVersion: '1.0.0' }] }),
      installed,
    );
    expect(r.ok).toBe(false);
  });
});

// ---- derivePackCapabilities ----

describe('derivePackCapabilities', () => {
  it('returns capabilities from manifest.capabilities', () => {
    const caps = derivePackCapabilities(minimalManifest({ capabilities: ['notes:write', 'ai:invoke'] }));
    expect(caps).toContain('notes:write');
    expect(caps).toContain('ai:invoke');
  });

  it('returns empty array when no capabilities', () => {
    expect(derivePackCapabilities(minimalManifest())).toEqual([]);
  });
});

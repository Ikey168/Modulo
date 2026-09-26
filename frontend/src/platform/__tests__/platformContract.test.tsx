import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
const platform = vi.hoisted(() => {
  window.__MODULO_CONFIG__ = { serverOrigin: 'https://modulo.example.com', oidcIssuer: 'https://modulo.example.com/auth/realms/modulo' };
  return { name: 'android' };
});
vi.mock('@capacitor/core', async importOriginal => ({ ...(await importOriginal<object>()), Capacitor: { getPlatform: () => platform.name, isNativePlatform: () => platform.name === 'android' } }));
import { CAPABILITIES, capabilityGaps, capabilityStatus, platformKind } from '../capabilities';
import { desktopServices } from '../desktop';
import { CATALOG } from '../../features/workspace/plugins/catalog';
import { PluginRuntime } from '../../features/workspace/plugins/runtime';
import RenderedNoteDisplay from '../../features/notes/RenderedNoteDisplay';

afterEach(() => { platform.name = 'android'; delete (window as { moduloDesktop?: unknown }).moduloDesktop; });

describe('platform capability contract', () => {
  it('detects the platform', () => {
    expect(platformKind()).toBe('android');
    platform.name = 'web';
    expect(platformKind()).toBe('web');
    (window as { moduloDesktop?: unknown }).moduloDesktop = { isDesktop: true };
    expect(platformKind()).toBe('electron');
    expect(desktopServices()).toBeDefined();
  });

  it('never hands desktop services to Android or the browser', () => {
    expect(desktopServices()).toBeUndefined();
  });

  it('gives every unavailable capability an actionable message', () => {
    for (const kind of ['web', 'electron', 'android'] as const) {
      for (const capability of CAPABILITIES) {
        const status = capabilityStatus(capability, kind);
        if (!status.available) expect(status.message.length, `${kind}/${capability}`).toBeGreaterThan(20);
      }
    }
    // Network services and PDF tools run on the Modulo server off the desktop (#495); folders and OCR stay gaps.
    expect(capabilityStatus('remote.fetch', 'android').available).toBe(true);
    expect(capabilityStatus('device.folders', 'android')).toMatchObject({ available: false, issue: expect.stringContaining('/issues/495') });
    expect(capabilityGaps(['files.pick', 'pdf.tools', 'documents.ocr'], 'android').map(gap => gap.capability)).toEqual(['documents.ocr']);
  });

  it('declares only known capabilities in the catalog', () => {
    for (const plugin of CATALOG) for (const capability of plugin.capabilities ?? []) expect(CAPABILITIES, plugin.id).toContain(capability);
  });
});

describe('full plugin runtime on Android', () => {
  it('installs, activates and uninstalls every runnable plugin with its dependencies', async () => {
    const runtime = new PluginRuntime(CATALOG);
    await runtime.init();
    for (const plugin of CATALOG.filter(item => item.load)) await runtime.install(plugin.id);
    for (const plugin of CATALOG.filter(item => item.load)) expect(runtime.isActive(plugin.id), plugin.id).toBe(true);
    expect(runtime.contributions().views.length).toBeGreaterThan(200);
    // Dependencies block uninstalling a plugin others need, like desktop.
    const needed = CATALOG.find(plugin => runtime.dependents(plugin.id).length > 0)!;
    await expect(runtime.uninstall(needed.id)).rejects.toThrow();
    const leaf = CATALOG.find(plugin => plugin.load && !plugin.builtin && runtime.dependents(plugin.id).length === 0)!;
    await runtime.uninstall(leaf.id);
    expect(runtime.isInstalled(leaf.id)).toBe(false);
    await runtime.dispose();
  });
});

describe('untrusted rendered content', () => {
  it('runs interactive output in a cross-origin sandbox without bridge access', () => {
    const { container } = render(<RenderedNoteDisplay content="<script>parent.Capacitor</script>" mimeType="text/html" isInteractive metadata={{}} rendererId="test" />);
    const frame = container.querySelector('iframe')!;
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
  });
});

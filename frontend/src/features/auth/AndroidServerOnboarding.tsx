import { deviceDocuments } from '../../services/deviceDocuments';
import { useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ModuloMark } from '../home/brand';
import { nativeStateCache } from '../../services/nativeStateCacheBridge';
import { normalizeAndroidServer, probeAndroidServer } from '../../services/androidServer';

function AndroidServerOnboarding({ saved }: { saved: string | null }) {
  const [address, setAddress] = useState(saved ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const origin = normalizeAndroidServer(address);
      await probeAndroidServer(origin);
      await nativeStateCache.setServer({ origin });
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not connect to this server.');
      setBusy(false);
    }
  };

  return <main className="flex min-h-app items-center justify-center bg-background px-6 text-foreground">
    {/* `noValidate`: the address rule here is the app's, not the browser's.
        `normalizeAndroidServer` deliberately requires an explicit https:// and
        no path, and says so — where the built-in check for type="url" replaces
        that with a bare "Please enter a URL." tooltip and no way to learn what
        it actually wants. */}
    <form onSubmit={connect} noValidate className="w-full max-w-sm space-y-6">
      <ModuloMark size={40} className="text-primary" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Connect to Modulo</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">Enter the HTTPS address you use to open Modulo in a browser. Your Android app will use that server for your account and records.</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="android-server" className="block text-sm font-medium">Server address</label>
        <p className="text-xs text-muted-foreground">Include <code className="font-mono">https://</code>.</p>
        <input id="android-server" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off"
          autoComplete="url" required placeholder="https://modulo.example.com" value={address}
          onChange={event => setAddress(event.target.value)}
          className="min-h-touch w-full rounded-md border border-border bg-background px-3 py-3 text-base outline-none focus:border-primary" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy}
        className="min-h-touch w-full rounded-md bg-primary px-4 py-3 text-base font-medium text-primary-foreground disabled:opacity-60">
        {busy ? 'Checking server…' : 'Continue'}
      </button>
    </form>
  </main>;
}

export function renderAndroidServerOnboarding(saved: string | null): void {
  // This screen renders before the app (and its ThemeProvider) ever mounts, so
  // it was drawing on the bare :root tokens — the emerald palette — while the
  // rest of the app, its splash and its launcher icon are Bart orange. The
  // first screen of the app should not be the only one in a different theme.
  document.documentElement.setAttribute('data-theme', 'bart');
  void deviceDocuments().get<string>('preference.theme').then((theme) => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
  }).catch(() => { /* Keep the default theme when device storage is unavailable. */ });
  createRoot(document.getElementById('root')!).render(<AndroidServerOnboarding saved={saved} />);
}

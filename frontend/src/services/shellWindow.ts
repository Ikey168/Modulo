/**
 * Bridge to the packaged Android window (ShellWindowPlugin).
 *
 * Two directions:
 *   - out: which way to draw the system bar icons, since the window is edge to
 *     edge and the web app's own surface is what sits behind them;
 *   - in: how much of the viewport the soft keyboard covers. Native insets the
 *     WebView for the IME, which is what keeps the focused field on screen —
 *     but it also means the page can no longer detect the keyboard by watching
 *     viewport heights, because both shrank by the same amount.
 *
 * Every export is a no-op outside the packaged Android shell.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

interface KeyboardInsetEvent {
  /** Covered height in CSS pixels; 0 when the keyboard is closed. */
  height: number;
}

interface ShellWindowPlugin {
  setAppearance(options: { dark: boolean }): Promise<void>;
  addListener(
    event: 'keyboardInsetChange',
    handler: (data: KeyboardInsetEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const isAndroid = () => Capacitor.getPlatform() === 'android';

const plugin = registerPlugin<ShellWindowPlugin>('ModuloShellWindow');

/** Tell Android whether the canvas behind its bars is dark. */
export async function setSystemBarAppearance(dark: boolean): Promise<void> {
  if (!isAndroid()) return;
  await plugin.setAppearance({ dark });
}

/** Subscribe to native keyboard inset changes. Returns a cleanup function. */
export async function onKeyboardInset(
  handler: (height: number) => void,
): Promise<() => void> {
  if (!isAndroid()) return () => {};
  const subscription = await plugin.addListener('keyboardInsetChange', (event) => {
    handler(Math.max(0, Math.round(event?.height ?? 0)));
  });
  return () => {
    void subscription.remove();
  };
}

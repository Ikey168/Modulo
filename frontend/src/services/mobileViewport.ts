/**
 * Viewport and input-modality plumbing for the packaged phone shell.
 *
 * Two things a WebView gets wrong for an app and CSS alone cannot fix:
 *
 * 1. `100vh` is the *largest* viewport, so on Android the shell's last row
 *    hides behind the system bars, and nothing shrinks when the soft keyboard
 *    opens. `visualViewport` reports what is actually visible.
 * 2. Nothing tells the UI that the keyboard is up. Without that a fixed bottom
 *    navigation floats on top of the keyboard while the field being typed into
 *    is pushed off screen.
 *
 * Both are published as document state — `--app-viewport-height`,
 * `--keyboard-inset` and `html[data-keyboard]` — so styles react to them
 * without every screen subscribing to a resize listener.
 */
import { Capacitor } from '@capacitor/core';
import { onKeyboardInset } from './shellWindow';

/** Soft keyboards are at least this tall; below it, the delta is browser chrome. */
const KEYBOARD_THRESHOLD_PX = 120;

function setPlatformAttributes(root: HTMLElement): void {
  const platform = Capacitor.getPlatform();
  root.dataset.platform = platform;
  // `native` distinguishes the installed app from the same build served in a
  // mobile browser, where the OS supplies its own chrome and back gesture.
  if (Capacitor.isNativePlatform()) root.dataset.native = 'true';
}

/**
 * @param open     the soft keyboard is showing.
 * @param overlap  how much of the *layout* viewport it covers, which is what a
 *                 `position: fixed` element has to be lifted by. Zero in the
 *                 packaged shell, where native has already resized the WebView
 *                 and lifting again would double-count the keyboard.
 */
function publishKeyboard(root: HTMLElement, open: boolean, overlap: number): void {
  root.style.setProperty('--keyboard-inset', `${Math.round(overlap)}px`);
  if (open) root.dataset.keyboard = 'open';
  else delete root.dataset.keyboard;
}

/**
 * Start publishing viewport state. Returns a cleanup function; safe to call in
 * any environment (a no-op where `window` or `visualViewport` is absent).
 */
export function startMobileViewport(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const root = document.documentElement;
  setPlatformAttributes(root);

  // The packaged shell insets the WebView for the IME, so by the time the page
  // sees a resize the layout and visual viewports have shrunk together and the
  // keyboard is invisible to the heuristic below. Native reports the real
  // number; once it does, it is the only source that gets to set it.
  let nativeKeyboard = false;
  let stopNative: (() => void) | undefined;
  let disposed = false;
  void onKeyboardInset((height) => {
    nativeKeyboard = true;
    if (!disposed) publishKeyboard(root, height > 0, 0);
  })
    .then((remove) => {
      if (disposed) remove();
      else stopNative = remove;
    })
    .catch((error) => console.error('Keyboard inset unavailable:', error));

  const viewport = window.visualViewport;
  if (!viewport) {
    return () => {
      disposed = true;
      stopNative?.();
    };
  }

  let frame = 0;
  const apply = () => {
    frame = 0;
    const visible = viewport.height;
    root.style.setProperty('--app-viewport-height', `${Math.round(visible)}px`);
    if (nativeKeyboard) return;

    // The keyboard covers the gap between the layout viewport and what is left
    // visible below the (possibly scrolled) visual viewport.
    const covered = Math.max(0, window.innerHeight - visible - viewport.offsetTop);
    const keyboard = covered >= KEYBOARD_THRESHOLD_PX ? covered : 0;
    publishKeyboard(root, keyboard > 0, keyboard);
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(apply);
  };

  apply();
  viewport.addEventListener('resize', schedule);
  viewport.addEventListener('scroll', schedule);
  window.addEventListener('orientationchange', schedule);

  return () => {
    disposed = true;
    stopNative?.();
    if (frame) window.cancelAnimationFrame(frame);
    viewport.removeEventListener('resize', schedule);
    viewport.removeEventListener('scroll', schedule);
    window.removeEventListener('orientationchange', schedule);
    root.style.removeProperty('--app-viewport-height');
    root.style.removeProperty('--keyboard-inset');
    delete root.dataset.keyboard;
  };
}

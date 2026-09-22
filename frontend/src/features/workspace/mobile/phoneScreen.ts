/**
 * Lets a view tell the phone shell that it has taken over the screen.
 *
 * A hub tab on a phone stacks three bars before any content: the app bar
 * naming the hub, the hub's tab strip, and the view's own header. That is
 * reasonable while you are choosing what to look at, and wasteful once you are
 * looking at it — opening a note left about 170px of a 883px screen spent on
 * chrome, two rows of which were about *other* screens.
 *
 * So a view that opens a full-screen detail (the note editor, today) declares
 * itself immersive, and the shell folds away the bars that are no longer
 * about what is on screen. The view keeps its own header, which carries the
 * back affordance — exactly the Android detail-screen pattern.
 *
 * Desktop is unaffected: there both levels are visible at once anyway, so
 * nothing ever becomes immersive.
 *
 * The provider lives in `PhoneScreenProvider.tsx`; context and hooks are here
 * so neither file mixes components with plain exports.
 */
import { createContext, useContext, useEffect } from 'react';

export interface PhoneScreenApi {
  /** True while a view has claimed the whole phone screen. */
  immersive: boolean;
  /** Views call this through `usePhoneImmersive`, not directly. */
  claim: (owner: string, immersive: boolean) => void;
}

export const PhoneScreenContext = createContext<PhoneScreenApi | null>(null);

/** Read whether any view has claimed the screen. Shell-side. */
export function usePhoneScreen(): boolean {
  return useContext(PhoneScreenContext)?.immersive ?? false;
}

/**
 * Claim the phone screen for as long as `immersive` is true.
 *
 * @param owner a stable id for the claiming view, so two views cannot fight.
 */
export function usePhoneImmersive(owner: string, immersive: boolean): void {
  const api = useContext(PhoneScreenContext);
  useEffect(() => {
    if (!api) return;
    api.claim(owner, immersive);
    return () => api.claim(owner, false);
    // `api` is a fresh object each render; the flag and owner are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, immersive]);
}

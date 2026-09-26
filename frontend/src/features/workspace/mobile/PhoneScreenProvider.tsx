/**
 * Holds the immersive claim for the phone shell. See `phoneScreen.ts`.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { PhoneScreenContext, type PhoneScreenApi } from './phoneScreen';

export function PhoneScreenProvider({ children }: { children: ReactNode }) {
  // Keyed by owner so a view unmounting mid-transition cannot leave the shell
  // stuck with no app bar.
  const [owners, setOwners] = useState<Record<string, boolean>>({});

  const value = useMemo<PhoneScreenApi>(
    () => ({
      immersive: Object.values(owners).some(Boolean),
      claim: (owner, immersive) =>
        setOwners((current) => {
          if (Boolean(current[owner]) === immersive) return current;
          const next = { ...current };
          if (immersive) next[owner] = true;
          else delete next[owner];
          return next;
        }),
    }),
    [owners],
  );

  return <PhoneScreenContext.Provider value={value}>{children}</PhoneScreenContext.Provider>;
}

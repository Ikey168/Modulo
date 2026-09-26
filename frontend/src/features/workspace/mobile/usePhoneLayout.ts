import { useEffect, useState } from 'react';

/**
 * The same test the `phone:` Tailwind variant uses: narrow *and* touch-driven.
 *
 * Width alone is the wrong question — a 1024px tablet is a touch device and a
 * 700px desktop window is not — and the two definitions must agree, or a
 * narrowed desktop window gets a phone-shaped component with none of the phone
 * stylesheet behind it.
 */
export const PHONE_QUERY = '(max-width: 767px) and (pointer: coarse)';

export function usePhoneLayout(): boolean {
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.(PHONE_QUERY).matches ?? false),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return phone;
}

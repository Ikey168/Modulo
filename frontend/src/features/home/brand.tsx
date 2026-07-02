/**
 * Shared Modulo branding — the four-square logo mark and the feature icon set
 * used by the landing page (Home) and the auth screens (LoginPage, AuthScreen).
 *
 * Everything renders with `currentColor` so color comes from Tailwind token
 * classes at the call site (e.g. `text-primary`, `text-success`) and follows
 * the active theme.
 */

export interface BrandIconProps {
  size?: number;
  className?: string;
}

/** The Modulo four-square logo mark. Color it with `text-primary`. */
export function ModuloMark({ size = 28, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" className={className} aria-hidden="true">
      <rect x={1} y={1} width={9} height={9} rx={2} fill="currentColor" />
      <rect x={12} y={1} width={9} height={9} rx={2} fill="currentColor" opacity={0.4} />
      <rect x={1} y={12} width={9} height={9} rx={2} fill="currentColor" opacity={0.4} />
      <rect x={12} y={12} width={9} height={9} rx={2} fill="currentColor" opacity={0.7} />
    </svg>
  );
}

/** Wiki-style linked notes. */
export function LinkIcon({ size = 18, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 11l4-4M6.5 4.5l1-1a3 3 0 014 4l-1 1M11.5 13.5l-1 1a3 3 0 01-4-4l1-1"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Knowledge graph. */
export function GraphIcon({ size = 18, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <circle cx={9} cy={9} r={2.4} stroke="currentColor" strokeWidth={1.4} />
      <circle cx={3} cy={3} r={1.6} stroke="currentColor" strokeWidth={1.3} />
      <circle cx={15} cy={4} r={1.6} stroke="currentColor" strokeWidth={1.3} />
      <circle cx={14} cy={15} r={1.6} stroke="currentColor" strokeWidth={1.3} />
      <path
        d="M7.2 7.2L4.2 4.2M10.9 7.6L13.4 5.2M10.6 10.6L13 13.6"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Real-time sync. */
export function SyncIcon({ size = 18, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <path d="M3 9a6 6 0 0110-4.5M15 9a6 6 0 01-10 4.5" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      <path
        d="M13 2.5V5h-2.5M5 15.5V13h2.5"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** On-chain anchoring. */
export function AnchorIcon({ size = 18, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <path d="M9 3v9M6 5.5L9 3l3 2.5" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3 12v1.5A1.5 1.5 0 004.5 15h9a1.5 1.5 0 001.5-1.5V12"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Plugin marketplace. */
export function PluginIcon({ size = 18, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 6h3V3.5A1.5 1.5 0 017.5 2h0A1.5 1.5 0 019 3.5V6h3v3h2.5A1.5 1.5 0 0116 10.5h0A1.5 1.5 0 0114.5 12H12v3H3V6z"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Flexible auth / security. */
export function ShieldIcon({ size = 18, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <path d="M9 2l5 2v4c0 3.2-2.1 6-5 7-2.9-1-5-3.8-5-7V4l5-2z" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M6.8 9l1.6 1.6L11.4 7.5" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

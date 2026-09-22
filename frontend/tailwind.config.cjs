/**
 * Modulo design system — Tailwind configuration.
 *
 * The whole app unifies on the "emerald terminal" aesthetic: green-black ink
 * surfaces, an emerald accent, Inter body / JetBrains Mono display type, sharp
 * corners. Colors are expressed as semantic tokens backed by CSS variables
 * (HSL channels) declared in src/styles/index.css, so opacity modifiers
 * (bg-primary/10) work and the alternate themes re-declare the variables
 * under [data-theme] selectors.
 */
const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Structural surfaces
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          2: 'hsl(var(--surface-2) / <alpha-value>)',
          3: 'hsl(var(--surface-3) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'hsl(var(--border) / <alpha-value>)',
          strong: 'hsl(var(--border-strong) / <alpha-value>)',
        },
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        // Semantic roles
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          hover: 'hsl(var(--primary-hover) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        subtle: {
          foreground: 'hsl(var(--subtle-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          foreground: 'hsl(var(--warning-foreground) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          foreground: 'hsl(var(--info-foreground) / <alpha-value>)',
        },
      },
      spacing: {
        // Device chrome, published as CSS variables by styles/index.css and
        // services/mobileViewport.ts. `pt-safe-top` / `pb-safe-bottom` are the
        // only sanctioned way to clear a notch or a gesture bar.
        'safe-top': 'var(--safe-top, 0px)',
        'safe-bottom': 'var(--safe-bottom, 0px)',
        'safe-left': 'var(--safe-left, 0px)',
        'safe-right': 'var(--safe-right, 0px)',
        /** Height of the phone bottom navigation, 0 when it is not mounted. */
        'bottom-nav': 'var(--bottom-nav-height, 0px)',
        /** Clearance for the floating action button, 0 when it is not mounted. */
        fab: 'var(--fab-inset, 0px)',
        /** Everything the phone docks over the content column, in one token. */
        'app-bottom': 'calc(var(--bottom-nav-height, 0px) + var(--fab-inset, 0px))',
        /** Soft-keyboard overlap reported by visualViewport. */
        keyboard: 'var(--keyboard-inset, 0px)',
        /** Material's 56dp app bar / 48dp minimum touch target. */
        'app-bar': '3.5rem',
        touch: '3rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // App runs slightly tighter than the browser default (13.5px base).
        xxs: ['0.6875rem', { lineHeight: '1rem' }],
      },
      height: {
        /** Visible viewport minus the device insets the body already pads for.
         *  `h-screen` overflows on a phone because 100vh ignores both. */
        app: 'calc(var(--app-viewport-height, 100vh) - var(--safe-top, 0px) - var(--safe-bottom, 0px))',
      },
      minHeight: {
        app: 'calc(var(--app-viewport-height, 100vh) - var(--safe-top, 0px) - var(--safe-bottom, 0px))',
        touch: '3rem',
      },
      borderRadius: {
        // All tiers follow the token so the corner language changes in one place.
        sm: 'calc(var(--radius) - 2px)',
        md: 'var(--radius)',
        lg: 'calc(var(--radius) + 2px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 6px)',
      },
      boxShadow: {
        // Var-backed so elevation softens on the light themes (see index.css).
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: '0 0 0 1px hsl(var(--primary) / 0.4), 0 8px 24px hsl(var(--primary) / 0.15)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease',
        'fade-up': 'fade-up 0.25s ease',
        'scale-in': 'scale-in 0.15s ease',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    /**
     * Input-modality and shell variants.
     *
     * The app is one codebase for a desktop pointer and an Android touch
     * screen. Breakpoints alone cannot express the difference — a 1024px
     * tablet is touch, a 700px desktop window is not — so control sizing keys
     * off `coarse:` (the pointer) and layout keys off `md:` (the space).
     */
    plugin(({ addVariant }) => {
      addVariant('coarse', '@media (pointer: coarse)');
      addVariant('fine', '@media (pointer: fine)');
      // Phone-shaped: below the tablet breakpoint AND touch-driven.
      addVariant('phone', '@media (max-width: 767px) and (pointer: coarse)');
      // Packaged Android shell (set on <html> by services/mobileViewport.ts).
      addVariant('native', ':where(html[data-platform="android"]) &');
      // Soft keyboard is covering part of the viewport.
      addVariant('kb-open', ':where(html[data-keyboard="open"]) &');
    }),
  ],
};

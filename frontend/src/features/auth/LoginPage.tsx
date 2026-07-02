import React, { useState, useEffect, type ReactNode } from 'react';
import { useLocation, Navigate, useSearchParams, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { loginWithOIDC, setCredentials, selectIsAuthenticated, selectAuthLoading, selectAuthError, clearError } from './authSlice';
import { Button, Spinner } from '@/ui';
import { ModuloMark, LinkIcon, GraphIcon, AnchorIcon } from '../home/brand';

// Mirrors RequireAuth: when enabled, sign-in skips Keycloak and enters the app
// as a mock user. Gated on import.meta.env so it can't ship to production.
const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

interface Highlight {
  title: string;
  desc: string;
  icon: ReactNode;
}

const HIGHLIGHTS: Highlight[] = [
  {
    title: 'Linked notes',
    desc: 'Markdown notes connected with wiki-style [[links]].',
    icon: <LinkIcon size={16} className="text-primary-hover" />,
  },
  {
    title: 'Knowledge graph',
    desc: 'Explore your network of ideas visually.',
    icon: <GraphIcon size={16} className="text-primary-hover" />,
  },
  {
    title: 'On-chain anchoring',
    desc: 'Prove authorship and timestamp notes on-chain.',
    icon: <AnchorIcon size={16} className="text-success" />,
  },
];

const LoginPage: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();

  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);

  const [localError, setLocalError] = useState<string | null>(null);

  // Get the intended destination from location state (defaults into the workspace)
  const from = location.state?.from?.pathname || '/app/marketplace';

  // Check for callback errors
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setLocalError(
        error === 'callback_failed'
          ? 'Authentication failed. Please try again.'
          : 'An error occurred during authentication.',
      );
    }
  }, [searchParams]);

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  // If already authenticated, redirect to the intended destination
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleOIDCLogin = async () => {
    // Dev bypass: enter the app as a mock user without contacting Keycloak.
    if (DEV_BYPASS) {
      dispatch(
        setCredentials({
          user: { id: 'dev', name: 'Dev User', email: 'dev@modulo.local', authProvider: 'oidc', roles: ['ADMIN'] },
        }),
      );
      return;
    }

    try {
      setLocalError(null);
      dispatch(clearError());

      // Store return URL for after authentication
      sessionStorage.setItem('returnTo', from);

      await dispatch(loginWithOIDC()).unwrap();
      // Redirect will happen via authService
    } catch (err) {
      setLocalError('Failed to initiate login. Please try again.');
    }
  };

  const error = authError || localError;

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      {/* Branded hero (hidden on narrow screens) */}
      <aside className="relative hidden flex-1 flex-col overflow-hidden border-r border-border bg-gradient-to-br from-surface to-background px-14 py-12 lg:flex">
        {/* Ambient emerald glow */}
        <div className="pointer-events-none absolute -left-32 -top-52 h-[560px] w-[680px] rounded-full bg-primary/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <ModuloMark size={28} className="text-primary" />
          <span className="text-lg font-semibold tracking-tight">Modulo</span>
        </div>

        <div className="relative mt-auto max-w-md">
          <h1 className="mb-4 text-4xl font-semibold leading-[1.1] tracking-tight">
            Own your knowledge.
            <br />
            <span className="text-primary-hover">Connect every idea.</span>
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-subtle-foreground">
            A decentralized knowledge-management workspace — linked Markdown notes,
            a live graph, real-time sync, and verifiable on-chain authorship.
          </p>

          <div className="flex flex-col gap-4">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-2">
                  {h.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{h.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{h.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-auto pt-8 text-xs text-muted-foreground/70">
          Secured with OpenID Connect and PKCE
        </div>
      </aside>

      {/* Sign-in card */}
      <main className="flex w-full flex-1 items-center justify-center px-7 py-10 lg:w-[480px] lg:flex-none">
        <div className="w-full max-w-[340px] animate-fade-up">
          <div className="mb-7 flex items-center gap-2.5">
            <ModuloMark size={26} className="text-primary" />
            <span className="text-base font-semibold tracking-tight">Modulo</span>
          </div>

          <h2 className="mb-1.5 text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mb-6 text-sm text-muted-foreground">Sign in to your workspace</p>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start justify-between gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive"
            >
              <span>{error}</span>
              <button
                type="button"
                className="text-base leading-none text-destructive transition-opacity hover:opacity-70"
                onClick={() => {
                  setLocalError(null);
                  dispatch(clearError());
                }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          <Button className="w-full" size="lg" onClick={handleOIDCLogin} disabled={isLoading}>
            {isLoading ? (
              <Spinner className="size-4" />
            ) : (
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6.5 2h-3A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h3" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
                <path d="M9.5 11L12.5 8 9.5 5M12.5 8h-8" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {isLoading ? 'Signing in…' : DEV_BYPASS ? 'Continue to workspace (dev)' : 'Sign in with Keycloak'}
          </Button>

          <p className="mt-3.5 text-center text-xs text-muted-foreground">
            {DEV_BYPASS ? 'Dev bypass enabled — Keycloak skipped' : 'OpenID Connect with PKCE'}
          </p>

          <div className="mt-6 border-t border-border pt-5">
            <p className="m-0 text-center text-xs leading-relaxed text-muted-foreground/70">
              New to Modulo?{' '}
              <Link to="/home" className="text-primary-hover hover:underline">Learn more</Link> or read{' '}
              <Link to="/about" className="text-primary-hover hover:underline">about the project</Link>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;

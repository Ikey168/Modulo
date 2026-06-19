import React, { useState, useEffect, type ReactNode } from 'react';
import { useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { loginWithOIDC, setCredentials, selectIsAuthenticated, selectAuthLoading, selectAuthError, clearError } from './authSlice';
import { ModuloMark, Spinner } from './AuthScreen';
import './auth.css';

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
    icon: (
      <svg width={16} height={16} viewBox="0 0 18 18" fill="none">
        <path d="M7 11l4-4M6.5 4.5l1-1a3 3 0 014 4l-1 1M11.5 13.5l-1 1a3 3 0 01-4-4l1-1" stroke="#818cf8" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Knowledge graph',
    desc: 'Explore your network of ideas visually.',
    icon: (
      <svg width={16} height={16} viewBox="0 0 18 18" fill="none">
        <circle cx={9} cy={9} r={2.4} stroke="#818cf8" strokeWidth={1.4} />
        <circle cx={3} cy={3} r={1.6} stroke="#818cf8" strokeWidth={1.3} />
        <circle cx={15} cy={4} r={1.6} stroke="#818cf8" strokeWidth={1.3} />
        <circle cx={14} cy={15} r={1.6} stroke="#818cf8" strokeWidth={1.3} />
        <path d="M7.2 7.2L4.2 4.2M10.9 7.6L13.4 5.2M10.6 10.6L13 13.6" stroke="#818cf8" strokeWidth={1.2} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'On-chain anchoring',
    desc: 'Prove authorship and timestamp notes on-chain.',
    icon: (
      <svg width={16} height={16} viewBox="0 0 18 18" fill="none">
        <path d="M9 3v9M6 5.5L9 3l3 2.5" stroke="#22c55e" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 12v1.5A1.5 1.5 0 004.5 15h9a1.5 1.5 0 001.5-1.5V12" stroke="#22c55e" strokeWidth={1.4} strokeLinecap="round" />
      </svg>
    ),
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
  const from = location.state?.from?.pathname || '/app/notes';

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
    <div className="login-split">
      {/* Branded hero (hidden on narrow screens) */}
      <aside className="login-aside">
        <div className="login-glow" />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
          <ModuloMark size={28} />
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.4px' }}>Modulo</span>
        </div>

        <div style={{ position: 'relative', marginTop: 'auto', maxWidth: 440 }}>
          <h1 style={{ margin: '0 0 16px', fontSize: 38, lineHeight: 1.1, fontWeight: 600, letterSpacing: '-1px' }}>
            Own your knowledge.
            <br />
            <span style={{ color: '#818cf8' }}>Connect every idea.</span>
          </h1>
          <p style={{ margin: '0 0 32px', fontSize: 15, lineHeight: 1.65, color: '#a1a1aa' }}>
            A decentralized knowledge-management workspace — linked Markdown notes,
            a live graph, real-time sync, and verifiable on-chain authorship.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="login-feature">
                <div className="dot">{h.icon}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#e4e4e7' }}>{h.title}</div>
                  <div style={{ fontSize: 12.5, color: '#71717a', marginTop: 2 }}>{h.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', marginTop: 'auto', paddingTop: 32, fontSize: 11.5, color: '#3f3f46' }}>
          Secured with OpenID Connect and PKCE
        </div>
      </aside>

      {/* Sign-in card */}
      <main className="login-main">
        <div style={{ width: '100%', maxWidth: 340, animation: 'authFadeUp .3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <ModuloMark size={26} />
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.3px' }}>Modulo</span>
          </div>

          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 600, letterSpacing: '-.4px' }}>Welcome back</h2>
          <p style={{ margin: '0 0 26px', fontSize: 13.5, color: '#71717a' }}>Sign in to your workspace</p>

          {error && (
            <div className="auth-error">
              <span>{error}</span>
              <button
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

          <button className="auth-btn" onClick={handleOIDCLogin} disabled={isLoading}>
            {isLoading ? (
              <Spinner size={16} />
            ) : (
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <path d="M6.5 2h-3A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h3" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
                <path d="M9.5 11L12.5 8 9.5 5M12.5 8h-8" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {isLoading ? 'Signing in…' : DEV_BYPASS ? 'Continue to workspace (dev)' : 'Sign in with Keycloak'}
          </button>

          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: '#52525b', textAlign: 'center' }}>
            {DEV_BYPASS ? 'Dev bypass enabled — Keycloak skipped' : 'OpenID Connect with PKCE'}
          </p>

          <div style={{ margin: '26px 0 0', paddingTop: 20, borderTop: '1px solid #1e1e24' }}>
            <p style={{ margin: 0, fontSize: 11.5, color: '#3f3f46', textAlign: 'center', lineHeight: 1.6 }}>
              By signing in, you agree to our{' '}
              <a href="/terms" className="auth-link">Terms of Service</a> and{' '}
              <a href="/privacy" className="auth-link">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;

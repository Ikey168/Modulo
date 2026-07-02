import React, { useState, useEffect } from 'react';
import { useLocation, Navigate, useSearchParams, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { loginWithOIDC, setCredentials, selectIsAuthenticated, selectAuthLoading, selectAuthError, clearError } from './authSlice';
import { Button, Spinner } from '@/ui';
import { ModuloMark } from '../home/brand';

// Mirrors RequireAuth: when enabled, sign-in skips Keycloak and enters the app
// as a mock user. Gated on import.meta.env so it can't ship to production.
const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

const LoginPage: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();

  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);

  const [localError, setLocalError] = useState<string | null>(null);

  // Get the intended destination from location state (defaults into the workspace)
  const from = location.state?.from?.pathname || '/app/dashboard';

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 font-sans text-foreground">
      {/* Ambient emerald glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl" />

      <main className="relative flex w-full max-w-[300px] animate-fade-up flex-col items-center text-center">
        <ModuloMark size={40} className="mb-6 text-primary" />

        <h1 className="mb-10 text-xl font-medium tracking-tight text-foreground">
          Own your knowledge<span className="text-primary">.</span>
        </h1>

        {error && (
          <div
            role="alert"
            className="mb-4 flex w-full items-start justify-between gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-left text-xs leading-relaxed text-destructive"
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
          {isLoading && <Spinner className="size-4" />}
          {isLoading ? 'Signing in…' : DEV_BYPASS ? 'Continue (dev)' : 'Sign in'}
        </Button>

        <Link
          to="/about"
          className="mt-8 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          about
        </Link>
      </main>
    </div>
  );
};

export default LoginPage;

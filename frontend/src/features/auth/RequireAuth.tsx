import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { selectIsAuthenticated, selectAuthInitialized, selectAuthLoading, initializeAuth, setCredentials } from './authSlice';
import { AuthLoading } from './AuthScreen';

interface RequireAuthProps {
  children: React.ReactNode;
}

// Dev-only escape hatch: when VITE_DEV_BYPASS_AUTH=true, the gate seeds a mock
// user and lets you straight into the app without Keycloak. Off by default and
// gated on import.meta.env so it cannot be enabled in a production build.
const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitialized = useAppSelector(selectAuthInitialized);
  const isLoading = useAppSelector(selectAuthLoading);
  const location = useLocation();

  useEffect(() => {
    if (DEV_BYPASS) {
      if (!isAuthenticated) {
        dispatch(
          setCredentials({
            user: { id: 'dev', name: 'Dev User', email: 'dev@modulo.local', authProvider: 'oidc', roles: ['ADMIN'] },
          }),
        );
      }
      return;
    }
    if (!isInitialized) {
      dispatch(initializeAuth());
    }
  }, [dispatch, isInitialized, isAuthenticated]);

  if (DEV_BYPASS) {
    // Render children as soon as the mock user is seeded.
    return isAuthenticated ? <>{children}</> : <AuthLoading message="Loading…" />;
  }

  // Show loading state while initializing auth
  if (!isInitialized || isLoading) {
    return <AuthLoading message="Loading…" />;
  }

  if (!isAuthenticated) {
    // Save the attempted location for post-login redirect
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
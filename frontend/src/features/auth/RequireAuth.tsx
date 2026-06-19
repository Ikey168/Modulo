import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { selectIsAuthenticated, selectAuthInitialized, selectAuthLoading, initializeAuth } from './authSlice';
import { AuthLoading } from './AuthScreen';

interface RequireAuthProps {
  children: React.ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitialized = useAppSelector(selectAuthInitialized);
  const isLoading = useAppSelector(selectAuthLoading);
  const location = useLocation();

  useEffect(() => {
    if (!isInitialized) {
      dispatch(initializeAuth());
    }
  }, [dispatch, isInitialized]);

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
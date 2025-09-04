import React from 'react';
import { useAppSelector } from '../../store/store';
import { selectUserRoles, selectIsAuthenticated } from './authSlice';
import { UserRole } from './oidcConfig';

interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAll?: boolean; // If true, user must have ALL roles; if false, user needs ANY role
}

const RoleGuard: React.FC<RoleGuardProps> = ({ 
  roles, 
  children, 
  fallback = null, 
  requireAll = false 
}) => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const userRoles = useAppSelector(selectUserRoles);

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  const hasRequiredRoles = requireAll
    ? roles.every(role => userRoles.includes(role))
    : roles.some(role => userRoles.includes(role));

  return hasRequiredRoles ? <>{children}</> : <>{fallback}</>;
};

export default RoleGuard;

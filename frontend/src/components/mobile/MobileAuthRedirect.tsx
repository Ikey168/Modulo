import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../../hooks/useResponsive';
import { useMobileAuth } from '../../features/auth/useMobileAuth';

export const MobileAuthRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { isAuthenticated } = useMobileAuth();

  useEffect(() => {
    if (isMobile && !isAuthenticated) {
      // Store the current path to return to after login
      const currentPath = window.location.pathname;
      sessionStorage.setItem('oauth_return_url', currentPath !== '/mobile/login' ? currentPath : '/dashboard');
      
      // Redirect to mobile login
      navigate('/mobile/login', { replace: true });
    }
  }, [isMobile, isAuthenticated, navigate]);

  // If not mobile or already authenticated, don't render anything
  // (parent component will handle the normal flow)
  return null;
};

export default MobileAuthRedirect;

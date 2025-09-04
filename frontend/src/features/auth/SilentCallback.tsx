import { useEffect } from 'react';
import { authService } from './authService';

const SilentCallback = () => {
  useEffect(() => {
    // Handle silent renewal
    authService.handleCallback().catch(error => {
      console.error('Silent renewal failed:', error);
    });
  }, []);

  return null; // This page should not be visible
};

export default SilentCallback;

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store/store';
import { handleAuthCallback } from './authSlice';

const AuthCallback = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      try {
        await dispatch(handleAuthCallback()).unwrap();
        // Redirect to the page the user was trying to access or dashboard
        const returnTo = sessionStorage.getItem('returnTo') || '/dashboard';
        sessionStorage.removeItem('returnTo');
        navigate(returnTo, { replace: true });
      } catch (error) {
        console.error('Authentication callback failed:', error);
        navigate('/login?error=callback_failed', { replace: true });
      }
    };

    processCallback();
  }, [dispatch, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;

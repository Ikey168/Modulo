import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store/store';
import { handleAuthCallback } from './authSlice';
import { AuthLoading } from './AuthScreen';

const AuthCallback = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      try {
        await dispatch(handleAuthCallback()).unwrap();
        // Redirect to the page the user was trying to access or the workspace
        const returnTo = sessionStorage.getItem('returnTo') || '/app/notes';
        sessionStorage.removeItem('returnTo');
        navigate(returnTo, { replace: true });
      } catch (error) {
        console.error('Authentication callback failed:', error);
        navigate('/login?error=callback_failed', { replace: true });
      }
    };

    processCallback();
  }, [dispatch, navigate]);

  return <AuthLoading message="Completing authentication…" />;
};

export default AuthCallback;


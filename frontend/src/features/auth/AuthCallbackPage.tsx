import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '../../store/store';
import { setCredentials } from './authSlice';
import { api } from '../../services/api';
import { AuthScreen, ModuloMark, Spinner } from './AuthScreen';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const loginSuccess = params.get('loginSuccess');

    if (loginSuccess === 'true') {
      // Fetch user details using our API client
      api.get('/user/me')
        .then(user => {
          if (user) {
            dispatch(setCredentials({ user }));
            navigate('/dashboard');
          } else {
            throw new Error('No user data received');
          }
        })
        .catch(error => {
          console.error('Error fetching user details:', error);
          navigate('/login');
        });
    } else {
      console.error('OAuth callback error or no success flag.');
      navigate('/login');
    }
  }, [navigate, location, dispatch]);

  return (
    <AuthScreen>
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 text-center shadow-lg animate-fade-up">
        <div className="mb-6 flex justify-center">
          <ModuloMark size={30} />
        </div>
        <h2 className="mb-4 text-center text-2xl font-semibold text-foreground">
          Authenticating...
        </h2>
        <div className="mb-4 flex justify-center">
          <Spinner size={26} color="#818cf8" />
        </div>
        <p className="text-sm text-muted-foreground">
          Please wait while we process your login
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          You will be redirected automatically
        </p>
      </div>
    </AuthScreen>
  );
};

export default AuthCallbackPage;

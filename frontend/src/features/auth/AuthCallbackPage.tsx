import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '../../store/store';
import { setCredentials } from './authSlice';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="mb-4 text-2xl font-bold text-gray-800 text-center">
          Authenticating...
        </h2>
        <LoadingSpinner size="large" message="Please wait while we process your login" />
        <p className="mt-4 text-sm text-gray-600 text-center">
          You will be redirected automatically
        </p>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthLoading } from './AuthScreen';

const OAuth2Redirect: React.FC = () => {
  const { provider } = useParams<{ provider: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (provider) {
      window.location.href = `/api/oauth2/authorization/${provider}`;
    } else {
      navigate('/login');
    }
  }, [provider, navigate]);

  return <AuthLoading message="Redirecting to login..." />;
};

export default OAuth2Redirect;

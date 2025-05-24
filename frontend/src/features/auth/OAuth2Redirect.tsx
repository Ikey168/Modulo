import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/common/LoadingSpinner';

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <LoadingSpinner size="large" message="Redirecting to login..." />
      </div>
    </div>
  );
};

export default OAuth2Redirect;
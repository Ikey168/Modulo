import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Building2, ChevronDown, ChevronUp, Lock, Smartphone, User, Wallet } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { useMobileAuth } from '../../features/auth/useMobileAuth';
import { ModuloMark } from '../../features/home/brand';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@/ui';

const GoogleIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
    <path d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.9.55 3.95 1.55l2.15-2.15A9 9 0 1 0 12 21c5.2 0 8.65-3.65 8.65-8.8 0-.4-.1-.75-.3-1.1z" />
  </svg>
);

const MicrosoftIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
    <path d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z" />
  </svg>
);

interface AuthButton {
  provider: string;
  label: string;
  icon: React.ReactNode;
  action: () => Promise<void>;
}

const MobileLoginPage: React.FC = () => {
  const location = useLocation();
  const { isMobile } = useResponsive();
  const {
    isAuthenticated,
    isLoading,
    error,
    authMethod,
    loginWithGoogle,
    loginWithMicrosoft,
    loginWithMetaMask,
    clearError,
  } = useMobileAuth();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get the intended destination from location state
  const from = location.state?.from?.pathname || '/dashboard';

  // If already authenticated, redirect to the intended destination
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const authButtons: AuthButton[] = [
    { provider: 'google', label: 'Continue with Google', icon: <GoogleIcon />, action: loginWithGoogle },
    { provider: 'microsoft', label: 'Continue with Microsoft', icon: <MicrosoftIcon />, action: loginWithMicrosoft },
    { provider: 'metamask', label: 'Connect with MetaMask', icon: <Wallet aria-hidden="true" />, action: loginWithMetaMask },
  ];
  const [google, microsoft, metamask] = authButtons;

  const handleAuthAction = async (provider: string, action: () => Promise<void>) => {
    setSelectedProvider(provider);
    try {
      await action();
    } catch (err) {
      console.error(`${provider} auth failed:`, err);
    } finally {
      setSelectedProvider(null);
    }
  };

  const renderAuthButton = (button: AuthButton, variant: 'primary' | 'outline' = 'outline') => {
    const loading = isLoading && selectedProvider === button.provider;
    return (
      <Button
        key={button.provider}
        variant={variant}
        size="lg"
        className="w-full"
        loading={loading}
        disabled={isLoading}
        onClick={() => handleAuthAction(button.provider, button.action)}
        aria-label={button.label}
      >
        {!loading && button.icon}
        {loading ? 'Connecting…' : button.label}
      </Button>
    );
  };

  return (
    // text-base keeps the effective font-size at 16px on this mobile-only page
    // so any form control inherits it and iOS Safari does not zoom on focus
    // (replaces the old global rule from styles/mobile.css).
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-10 text-base text-foreground sm:text-sm">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center gap-2.5">
            <ModuloMark size={28} className="text-primary" />
            <span className="text-xl font-semibold tracking-tight">Modulo</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Secure mobile login</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your preferred authentication method
          </p>
          {isMobile && (
            <Badge variant="secondary" className="mt-3 gap-1.5">
              <Smartphone className="size-3" aria-hidden="true" />
              Mobile device
            </Badge>
          )}
        </div>

        {/* Error alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="flex items-start justify-between gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={clearError}
                aria-label="Dismiss"
                className="text-base leading-none transition-opacity hover:opacity-70"
              >
                ×
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* Authentication methods */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Quick login</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {renderAuthButton(google, 'primary')}
            {renderAuthButton(microsoft)}

            <div className="relative my-2">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-subtle-foreground">
                or
              </span>
            </div>

            {renderAuthButton(metamask)}
            <p className="text-center text-xs text-muted-foreground">
              Connect your crypto wallet for secure blockchain authentication
            </p>
          </CardContent>
        </Card>

        {/* Advanced options */}
        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            {showAdvanced ? 'Hide advanced' : 'Show advanced'}
          </Button>

          {showAdvanced && (
            <div className="mt-2 flex flex-col gap-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Enterprise login</CardTitle>
                  <CardDescription>
                    Connect using your organization's identity provider
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => (window.location.href = '/login')}
                  >
                    <Building2 aria-hidden="true" />
                    Enterprise SSO
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Guest access</CardTitle>
                  <CardDescription>Limited access without authentication</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => (window.location.href = '/guest')}
                  >
                    <User aria-hidden="true" />
                    Continue as guest
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Auth status */}
        {authMethod && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {authMethod === 'oauth' ? 'OAuth' : 'Blockchain'} authentication active
          </p>
        )}

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2 border-t border-border pt-5">
          <p className="flex items-center gap-1.5 text-xs text-subtle-foreground">
            <Lock className="size-3" aria-hidden="true" />
            Your data is protected with enterprise-grade security
          </p>
          <div className="flex items-center gap-2 text-xs">
            <a href="/privacy" className="text-primary-hover hover:underline">
              Privacy Policy
            </a>
            <span className="text-subtle-foreground">•</span>
            <a href="/terms" className="text-primary-hover hover:underline">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileLoginPage;

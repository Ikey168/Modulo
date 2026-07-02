import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { mobileOAuthService } from '../../features/auth/mobileOAuthService';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Spinner,
} from '@/ui';

interface OAuthCallbackProps {
  provider: 'google' | 'microsoft';
}

export const OAuthCallback: React.FC<OAuthCallbackProps> = ({ provider }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  // OAuth authorization codes are single-use: guard against the effect running
  // twice (React 18 StrictMode) so we never attempt a second token exchange.
  const handled = useRef(false);

  const providerName = provider === 'google' ? 'Google' : 'Microsoft';

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const completeLogin = async () => {
      try {
        // The service owns the whole callback contract: it validates the
        // `state` param against its own sessionStorage entry, retrieves the
        // PKCE code verifier it stored when the flow started, exchanges the
        // code for tokens and fetches the user profile. We just pass the
        // callback query params straight through.
        const result = await mobileOAuthService.handleCallback(searchParams);

        if (!result.success) {
          throw new Error(result.error || `Failed to complete ${providerName} sign in`);
        }

        // Persist the session under the keys useMobileAuth reads on mount so
        // the app is authenticated after the redirect.
        sessionStorage.setItem('mobile_auth_user', JSON.stringify(result.user));
        sessionStorage.setItem('mobile_auth_method', result.type);

        const returnUrl = sessionStorage.getItem('oauth_return_url') || '/dashboard';
        sessionStorage.removeItem('oauth_return_url');
        navigate(returnUrl, { replace: true });
      } catch (err) {
        console.error(`${providerName} OAuth callback error:`, err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setIsProcessing(false);
      }
    };

    completeLogin();
  }, [navigate, searchParams, providerName]);

  const handleRetry = () => {
    navigate('/mobile/login', { replace: true });
  };

  if (isProcessing) {
    return (
      // text-base keeps the effective font-size at 16px on this mobile-only
      // page so any form control inherits it and iOS Safari does not zoom on
      // focus (replaces the old global rule from styles/mobile.css).
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-base text-foreground sm:text-sm">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <CardTitle>Completing {providerName} sign in</CardTitle>
            <CardDescription>Please wait while we process your authentication…</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 py-6">
            <Spinner className="size-8 text-primary" />
            <p className="text-sm text-muted-foreground">Verifying your credentials</p>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="flex items-center gap-1.5 text-xs text-subtle-foreground">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Your information is being securely processed
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-base text-foreground sm:text-sm">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>Sign in failed</CardTitle>
            <CardDescription>
              We encountered an issue while signing you in with {providerName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertTitle>Authentication error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <Button size="lg" className="w-full" onClick={handleRetry}>
              Back to login and try again
            </Button>

            <div className="rounded-lg border border-border bg-surface p-3">
              <h3 className="mb-1.5 text-xs font-semibold text-foreground">Troubleshooting tips</h3>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                <li>Ensure you have a stable internet connection</li>
                <li>Check if popup blockers are disabled</li>
                <li>Try clearing your browser cache and cookies</li>
                <li>Make sure JavaScript is enabled in your browser</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

// Individual callback components for easier routing
export const GoogleOAuthCallback: React.FC = () => (
  <OAuthCallback provider="google" />
);

export const MicrosoftOAuthCallback: React.FC = () => (
  <OAuthCallback provider="microsoft" />
);

import { type ReactNode } from 'react';
import { Spinner } from '@/ui';
import { ModuloMark } from '../home/brand';

// Full-screen themed container matching the workspace design system.
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-sm text-foreground">
      {children}
    </div>
  );
}

// Centered logo + spinner + message, used by callback and auth-gate loading states.
export function AuthLoading({ message }: { message: string }) {
  return (
    <AuthScreen>
      <div className="animate-fade-up text-center">
        <div className="mb-4 flex justify-center">
          <ModuloMark size={30} className="text-primary" />
        </div>
        <div className="mb-3.5 flex justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
        <p className="m-0 text-sm text-muted-foreground">{message}</p>
      </div>
    </AuthScreen>
  );
}

import { type ReactNode } from 'react';
import './auth.css';

// The Modulo four-square logo mark, shared across auth screens.
export function ModuloMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <rect x={1} y={1} width={9} height={9} rx={2} fill="#4f46e5" />
      <rect x={12} y={1} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
      <rect x={1} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
      <rect x={12} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.7} />
    </svg>
  );
}

export function Spinner({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,.18)',
        borderTopColor: color,
        animation: 'authSpin .7s linear infinite',
      }}
    />
  );
}

// Full-screen dark container matching the workspace theme.
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0b',
        color: '#f4f4f5',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 13.5,
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}

// Centered logo + spinner + message, used by callback and auth-gate loading states.
export function AuthLoading({ message }: { message: string }) {
  return (
    <AuthScreen>
      <div style={{ textAlign: 'center', animation: 'authFadeUp .25s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <ModuloMark size={30} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Spinner size={26} color="#818cf8" />
        </div>
        <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>{message}</p>
      </div>
    </AuthScreen>
  );
}

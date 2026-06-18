import { useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

interface HoverProps extends HTMLAttributes<HTMLDivElement> {
  style?: CSSProperties;
  hoverStyle?: CSSProperties;
  children?: ReactNode;
}

// A div that merges `hoverStyle` on top of `style` while hovered.
export function Hover({ children, style, hoverStyle, ...props }: HoverProps) {
  const [h, setH] = useState(false);
  return (
    <div
      {...props}
      style={{ ...style, ...(h ? hoverStyle : {}) }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {children}
    </div>
  );
}

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

export function NavItem({ active, onClick, icon, label }: NavItemProps) {
  return (
    <Hover
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '8px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        background: active ? '#1c1c22' : 'transparent',
        color: active ? '#f4f4f5' : '#71717a',
        fontWeight: 500,
        transition: 'background .1s',
      }}
      hoverStyle={{ background: '#1c1c22', color: '#f4f4f5' }}
    >
      {icon}
      {label}
    </Hover>
  );
}

interface UserPillProps {
  label: string;
  sublabel?: string;
  onClick: () => void;
}

// Sidebar footer pill showing the authenticated user; click to log out.
export function UserPill({ label, sublabel, onClick }: UserPillProps) {
  return (
    <Hover
      onClick={onClick}
      title="Log out"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 7,
        cursor: 'pointer',
        background: '#16161a',
        border: '1px solid #2a2a30',
        transition: 'border-color .1s',
      }}
      hoverStyle={{ borderColor: '#3f3f46' }}
    >
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: '#a1a1aa',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 10.5, color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sublabel}
          </div>
        )}
      </div>
      <svg width={12} height={12} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: '#52525b' }}>
        <path d="M4.5 1.5H2.5A1 1 0 001.5 2.5v7a1 1 0 001 1h2" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" />
        <path d="M7 8.5L9.5 6 7 3.5M9.5 6h-6" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Hover>
  );
}

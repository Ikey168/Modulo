import React, { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './home.css';

function ModuloMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <rect x={1} y={1} width={9} height={9} rx={2} fill="#4f46e5" />
      <rect x={12} y={1} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
      <rect x={1} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
      <rect x={12} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.7} />
    </svg>
  );
}

interface Feature {
  title: string;
  desc: string;
  icon: ReactNode;
}

const FEATURES: Feature[] = [
  {
    title: 'Linked notes',
    desc: 'Write in Markdown and connect ideas with wiki-style [[links]] that build automatically.',
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
        <path d="M7 11l4-4M6.5 4.5l1-1a3 3 0 014 4l-1 1M11.5 13.5l-1 1a3 3 0 01-4-4l1-1" stroke="#818cf8" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Knowledge graph',
    desc: 'See your entire network of notes as an interactive force-directed graph.',
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
        <circle cx={9} cy={9} r={2.4} stroke="#818cf8" strokeWidth={1.4} />
        <circle cx={3} cy={3} r={1.6} stroke="#818cf8" strokeWidth={1.3} />
        <circle cx={15} cy={4} r={1.6} stroke="#818cf8" strokeWidth={1.3} />
        <circle cx={14} cy={15} r={1.6} stroke="#818cf8" strokeWidth={1.3} />
        <path d="M7.2 7.2L4.2 4.2M10.9 7.6L13.4 5.2M10.6 10.6L13 13.6" stroke="#818cf8" strokeWidth={1.2} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Real-time sync',
    desc: 'Changes propagate live across every device over WebSocket, with offline support.',
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
        <path d="M3 9a6 6 0 0110-4.5M15 9a6 6 0 01-10 4.5" stroke="#818cf8" strokeWidth={1.4} strokeLinecap="round" />
        <path d="M13 2.5V5h-2.5M5 15.5V13h2.5" stroke="#818cf8" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'On-chain anchoring',
    desc: 'Timestamp and prove authorship of any note on Ethereum, with IPFS content addressing.',
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
        <path d="M9 3v9M6 5.5L9 3l3 2.5" stroke="#22c55e" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 12v1.5A1.5 1.5 0 004.5 15h9a1.5 1.5 0 001.5-1.5V12" stroke="#22c55e" strokeWidth={1.4} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Plugins',
    desc: 'Extend Modulo with renderers, integrations, and tools from the marketplace.',
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
        <path d="M3 6h3V3.5A1.5 1.5 0 017.5 2h0A1.5 1.5 0 019 3.5V6h3v3h2.5A1.5 1.5 0 0116 10.5h0A1.5 1.5 0 0114.5 12H12v3H3V6z" stroke="#818cf8" strokeWidth={1.3} strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Flexible auth',
    desc: 'Sign in with Keycloak (OIDC), Google, Azure AD, or a MetaMask wallet.',
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
        <path d="M9 2l5 2v4c0 3.2-2.1 6-5 7-2.9-1-5-3.8-5-7V4l5-2z" stroke="#818cf8" strokeWidth={1.3} strokeLinejoin="round" />
        <path d="M6.8 9l1.6 1.6L11.4 7.5" stroke="#818cf8" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const Home: React.FC = () => {
  return (
    <div className="landing">
      {/* Top navigation */}
      <header style={{ position: 'relative', zIndex: 1, maxWidth: 1080, margin: '0 auto', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ModuloMark size={26} />
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.4px' }}>Modulo</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a className="land-nav-link" href="https://github.com/Ikey168/Modulo" target="_blank" rel="noreferrer">GitHub</a>
          <a className="land-nav-link" href="/about">About</a>
          <Link to="/login" className="land-btn-ghost" style={{ padding: '8px 16px' }}>Sign in</Link>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ position: 'relative', maxWidth: 760, margin: '0 auto', padding: '72px 28px 64px', textAlign: 'center' }}>
        <div className="landing-glow" />
        <div style={{ position: 'relative', zIndex: 1, animation: 'landFadeUp .4s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 13px', borderRadius: 20, border: '1px solid #2a2a30', background: '#111114', fontSize: 12, color: '#a1a1aa', marginBottom: 26 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            Local-first knowledge, verifiable on-chain
          </div>
          <h1 style={{ margin: '0 0 18px', fontSize: 52, lineHeight: 1.05, fontWeight: 600, letterSpacing: '-1.5px' }}>
            Own your knowledge.
            <br />
            <span style={{ color: '#818cf8' }}>Connect every idea.</span>
          </h1>
          <p style={{ margin: '0 auto 32px', maxWidth: 540, fontSize: 16, lineHeight: 1.65, color: '#a1a1aa' }}>
            Modulo is a decentralized knowledge-management workspace. Write linked Markdown notes,
            explore them as a graph, sync in real time, and anchor authorship on-chain.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/app/notes" className="land-btn-primary">
              Open Modulo
              <svg width={15} height={15} viewBox="0 0 15 15" fill="none">
                <path d="M3 7.5h8M7 4l3.5 3.5L7 11" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link to="/login" className="land-btn-ghost">Sign in with Keycloak</Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '8px 28px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="land-card">
              <div style={{ width: 38, height: 38, borderRadius: 9, background: '#16161a', border: '1px solid #2a2a30', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 15 }}>
                {f.icon}
              </div>
              <h3 style={{ margin: '0 0 7px', fontSize: 15, fontWeight: 600, color: '#f4f4f5' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: '#71717a' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 28px 64px' }}>
        <div style={{ background: 'linear-gradient(180deg, #131318, #0e0e12)', border: '1px solid #1e1e24', borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 600, letterSpacing: '-.6px' }}>Start building your knowledge base</h2>
          <p style={{ margin: '0 auto 26px', maxWidth: 460, fontSize: 15, lineHeight: 1.6, color: '#a1a1aa' }}>
            Free your notes from silos. Create, link, and verify your ideas in one workspace.
          </p>
          <Link to="/app/notes" className="land-btn-primary" style={{ padding: '12px 24px', fontSize: 15 }}>
            Get started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1e1e24' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#52525b', fontSize: 13 }}>
            <ModuloMark size={18} />
            <span>Modulo</span>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
            <a className="land-nav-link" href="/about">About</a>
            <a className="land-nav-link" href="https://github.com/Ikey168/Modulo" target="_blank" rel="noreferrer">GitHub</a>
            <a className="land-nav-link" href="/settings">Settings</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

import React from 'react';
import { Link } from 'react-router-dom';

const ModuloMark = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden>
    <rect x={1} y={1} width={9} height={9} rx={2} fill="#4f46e5" />
    <rect x={12} y={1} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
    <rect x={1} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
    <rect x={12} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.7} />
  </svg>
);

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] gap-8 px-6 py-10 max-md:grid-cols-1">
        <div>
          <div className="flex items-center gap-2 text-foreground">
            <ModuloMark />
            <span className="text-sm font-semibold tracking-tight">Modulo</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            A decentralized knowledge-management workspace — linked notes, a live
            graph, real-time sync, and verifiable on-chain authorship.
          </p>
        </div>
        <div>
          <h4 className="text-xxs font-semibold uppercase tracking-wider text-muted-foreground">Links</h4>
          <ul className="mt-3 space-y-2 text-[13px]">
            <li><a href="/terms" className="text-subtle-foreground transition-colors hover:text-foreground">Terms of Service</a></li>
            <li><a href="/privacy" className="text-subtle-foreground transition-colors hover:text-foreground">Privacy Policy</a></li>
            <li><Link to="/about" className="text-subtle-foreground transition-colors hover:text-foreground">About</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xxs font-semibold uppercase tracking-wider text-muted-foreground">Contact</h4>
          <ul className="mt-3 space-y-2 text-[13px]">
            <li><a href="mailto:support@modulo.com" className="text-subtle-foreground transition-colors hover:text-foreground">support@modulo.com</a></li>
            <li>
              <a href="https://github.com/Ikey168/Modulo" target="_blank" rel="noreferrer" className="text-subtle-foreground transition-colors hover:text-foreground">
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-4 text-center text-xxs text-muted-foreground">
          © {new Date().getFullYear()} Modulo. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;

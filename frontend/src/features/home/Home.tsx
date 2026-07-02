import React, { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '@/ui';
import { ModuloMark, LinkIcon, GraphIcon, SyncIcon, AnchorIcon, PluginIcon, ShieldIcon } from './brand';

interface Feature {
  title: string;
  desc: string;
  icon: ReactNode;
}

const FEATURES: Feature[] = [
  {
    title: 'Linked notes',
    desc: 'Write in Markdown and connect ideas with wiki-style [[links]] that build automatically.',
    icon: <LinkIcon size={18} className="text-primary-hover" />,
  },
  {
    title: 'Knowledge graph',
    desc: 'See your entire network of notes as an interactive force-directed graph.',
    icon: <GraphIcon size={18} className="text-primary-hover" />,
  },
  {
    title: 'Real-time sync',
    desc: 'Changes propagate live across every device over WebSocket, with offline support.',
    icon: <SyncIcon size={18} className="text-primary-hover" />,
  },
  {
    title: 'On-chain anchoring',
    desc: 'Timestamp and prove authorship of any note on Ethereum, with IPFS content addressing.',
    icon: <AnchorIcon size={18} className="text-success" />,
  },
  {
    title: 'Plugins',
    desc: 'Extend Modulo with renderers, integrations, and tools from the marketplace.',
    icon: <PluginIcon size={18} className="text-primary-hover" />,
  },
  {
    title: 'Flexible auth',
    desc: 'Sign in with Keycloak (OIDC), Google, Azure AD, or a MetaMask wallet.',
    icon: <ShieldIcon size={18} className="text-primary-hover" />,
  },
];

const navLinkClass = 'text-sm text-subtle-foreground transition-colors hover:text-foreground';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-sm text-foreground antialiased">
      {/* Top navigation */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-7 py-5">
        <div className="flex items-center gap-2.5">
          <ModuloMark size={26} className="text-primary" />
          <span className="text-lg font-semibold tracking-tight">Modulo</span>
        </div>
        <nav className="flex items-center gap-5">
          <a className={navLinkClass} href="https://github.com/Ikey168/Modulo" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <Link className={navLinkClass} to="/about">
            About
          </Link>
          <Button asChild variant="outline" size="md">
            <Link to="/login">Sign in</Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-3xl px-7 pb-16 pt-16 text-center md:pt-20">
        {/* Ambient indigo glow behind the hero */}
        <div className="pointer-events-none absolute -top-64 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative z-10 animate-fade-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-xs text-subtle-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Local-first knowledge, verifiable on-chain
          </div>
          <h1 className="mb-5 text-5xl font-semibold leading-[1.05] tracking-tight md:text-[52px]">
            Own your knowledge.
            <br />
            <span className="text-primary-hover">Connect every idea.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-subtle-foreground">
            Modulo is a decentralized knowledge-management workspace. Write linked Markdown notes,
            explore them as a graph, sync in real time, and anchor authorship on-chain.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/app/notes">
                Open Modulo
                <svg width={15} height={15} viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M3 7.5h8M7 4l3.5 3.5L7 11" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/login">Sign in with Keycloak</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-7 pb-10 pt-2">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-border-strong">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface-2">
                {f.icon}
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-foreground">{f.title}</h3>
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-5xl px-7 pb-16 pt-10">
        <div className="rounded-2xl border border-border bg-gradient-to-b from-surface-2 to-surface p-12 text-center">
          <h2 className="mb-2.5 text-2xl font-semibold tracking-tight md:text-3xl">Start building your knowledge base</h2>
          <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-subtle-foreground">
            Free your notes from silos. Create, link, and verify your ideas in one workspace.
          </p>
          <Button asChild size="lg">
            <Link to="/app/notes">Get started</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-7 py-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ModuloMark size={18} className="text-primary" />
            <span>Modulo</span>
          </div>
          <div className="flex gap-5">
            <Link className={navLinkClass} to="/about">
              About
            </Link>
            <a className={navLinkClass} href="https://github.com/Ikey168/Modulo" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <Link className={navLinkClass} to="/settings">
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

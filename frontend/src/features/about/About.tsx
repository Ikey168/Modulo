import React, { type ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/ui';
import { ModuloMark, LinkIcon, GraphIcon, AnchorIcon, PluginIcon } from '../home/brand';

interface Capability {
  title: string;
  desc: string;
  icon: ReactNode;
}

const CAPABILITIES: Capability[] = [
  {
    title: 'Linked Markdown notes',
    desc: 'Write in Markdown and connect ideas with wiki-style [[links]] that resolve automatically.',
    icon: <LinkIcon size={18} className="text-primary-hover" />,
  },
  {
    title: 'Knowledge graph',
    desc: 'Explore your notes as an interactive graph and follow connections between ideas.',
    icon: <GraphIcon size={18} className="text-primary-hover" />,
  },
  {
    title: 'Blockchain-anchored integrity',
    desc: 'Optionally anchor note content hashes on-chain for verifiable authorship and timestamps.',
    icon: <AnchorIcon size={18} className="text-success" />,
  },
  {
    title: 'Plugins',
    desc: 'Extend the workspace with renderers, integrations, and tools from the plugin marketplace.',
    icon: <PluginIcon size={18} className="text-primary-hover" />,
  },
];

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl animate-fade-in space-y-6">
        <section className="text-center">
          <div className="mb-4 flex justify-center">
            <ModuloMark size={34} className="text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">About Modulo</h1>
          <p className="mt-2 text-base text-subtle-foreground">
            A decentralized knowledge-management workspace
          </p>
        </section>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What is Modulo?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-subtle-foreground">
                Modulo is a workspace for building a personal knowledge base you actually own.
                You write linked Markdown notes, explore them as a living knowledge graph, and
                sync changes in real time across devices. When integrity matters, Modulo can
                anchor a note's content hash on-chain — giving you verifiable authorship and
                tamper-evident timestamps without ever putting your content itself on a
                blockchain.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Core capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {CAPABILITIES.map((c) => (
                  <div key={c.title} className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-3">
                      {c.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{c.title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Technology stack</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm leading-relaxed text-subtle-foreground">
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Frontend: React with TypeScript
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Backend: Spring Boot with PostgreSQL and a Neo4j knowledge graph
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Integrity: Ethereum smart contracts for on-chain content-hash anchoring
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Security: OpenID Connect authentication and policy-based authorization
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Open source</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-subtle-foreground">
                Modulo is developed in the open. Browse the source, report issues, or
                contribute on{' '}
                <a
                  href="https://github.com/Ikey168/Modulo"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-hover hover:underline"
                >
                  github.com/Ikey168/Modulo
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default About;

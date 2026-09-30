import React, { type ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/ui';
import { ModuloMark, LinkIcon, GraphIcon, SyncIcon, PluginIcon } from '../home/brand';

interface Capability {
  title: string;
  desc: string;
  icon: ReactNode;
}

const CAPABILITIES: Capability[] = [
  {
    title: 'Notes and knowledge',
    desc: 'Markdown notes with [[wiki links]], typed properties and saved queries, a knowledge graph, semantic search, and answers cited from your own notes.',
    icon: <LinkIcon size={18} className="text-primary-hover" />,
  },
  {
    title: 'Plugins and packs',
    desc: 'Planner, canvas, finance, research, health, homelab and more. Install only what you need, or a whole pack in one step.',
    icon: <PluginIcon size={18} className="text-primary-hover" />,
  },
  {
    title: 'Accountable automation',
    desc: 'Visual Blueprint workflows whose every run is recorded step by step, and which can pause for a signed human approval.',
    icon: <GraphIcon size={18} className="text-primary-hover" />,
  },
  {
    title: 'Every device',
    desc: 'The same workspace in the browser, on the desktop and on Android, synced through your server and usable offline.',
    icon: <SyncIcon size={18} className="text-primary-hover" />,
  },
];

const PRINCIPLES: string[] = [
  'Your data lives on your server and belongs to your account, never in browser storage.',
  'Search and Ask Modulo run locally. Note text reaches a remote model only through AI summaries, which are off until you configure them.',
  'Custom code runs in a WebAssembly sandbox, and third-party backend plugins run outside the core in their own containers.',
  'The marketplace shows signatures, SBOMs and scan results before you install or upgrade anything.',
  'Optional services such as the graph database or on-chain anchoring can be down without stopping your notes.',
];

const About: React.FC = () => {
  return (
    <div className="min-h-app bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl animate-fade-in space-y-6">
        <section className="text-center">
          <div className="mb-4 flex justify-center">
            <ModuloMark size={34} className="text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">About Modulo</h1>
          <p className="mt-2 text-base text-subtle-foreground">
            A self-hosted personal operating system
          </p>
        </section>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What is Modulo?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-subtle-foreground">
                Modulo brings your notes, your records and the automations that act on them
                into one workspace that runs on infrastructure you control. A small core of
                linked Markdown notes forms a knowledge graph. Everything else is an installable
                plugin, from a daily planner to a finance ledger to a homelab inventory, and
                packs set up a complete area of your life in one step. It is also the front end
                for Noesis, which takes in research, and Praxis, which carries out tasks for you.
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
              <CardTitle className="text-lg">Principles</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm leading-relaxed text-subtle-foreground">
                {PRINCIPLES.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    {p}
                  </li>
                ))}
              </ul>
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
                  Clients: one React and TypeScript app for the browser, Electron desktop and Android
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Backend: Spring Boot with PostgreSQL, a Neo4j knowledge graph and a durable workflow engine
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Sandbox: QuickJS on WebAssembly for user code in workflows
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Security: Keycloak OpenID Connect sign-in, owner-scoped data and optional on-chain content anchoring
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

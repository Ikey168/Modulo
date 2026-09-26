import { useEffect, useMemo, useState } from 'react';
import type { NoteFenceProps } from './plugins/types';

const renderedDiagrams = new Map<string, string>();
const pendingDiagrams = new Map<string, Promise<string>>();
let mermaidSequence = 0;
let mermaidModule: Promise<typeof import('mermaid').default> | null = null;

const RENDER_TIMEOUT_MS = 20_000;
const MAX_CACHED_DIAGRAMS = 128;

function loadMermaid() {
  if (!mermaidModule) {
    mermaidModule = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' });
      return mermaid;
    });
  }
  return mermaidModule;
}

function remember(key: string, svg: string) {
  renderedDiagrams.delete(key);
  renderedDiagrams.set(key, svg);
  if (renderedDiagrams.size > MAX_CACHED_DIAGRAMS) {
    const oldest = renderedDiagrams.keys().next().value;
    if (oldest) renderedDiagrams.delete(oldest);
  }
}

function renderDiagram(key: string, source: string): Promise<string> {
  const cached = renderedDiagrams.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = pendingDiagrams.get(key);
  if (pending) return pending;

  const render = loadMermaid().then(async (mermaid) => {
    const id = `mermaid-${++mermaidSequence}`;
    const timeout = new Promise<never>((_resolve, reject) => {
      window.setTimeout(() => reject(new Error('Diagram rendering timed out.')), RENDER_TIMEOUT_MS);
    });
    const rendered = await Promise.race([mermaid.render(id, source), timeout]);
    remember(key, rendered.svg);
    return rendered.svg;
  }).finally(() => pendingDiagrams.delete(key));

  pendingDiagrams.set(key, render);
  return render;
}

export function MermaidFence({ source }: NoteFenceProps) {
  const normalizedSource = useMemo(() => source.trim(), [source]);
  const [retry, setRetry] = useState(0);
  const [svg, setSvg] = useState(() => renderedDiagrams.get(normalizedSource) ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const cached = renderedDiagrams.get(normalizedSource);
    if (cached) {
      setSvg(cached);
      setError(null);
      return () => { active = false; };
    }
    setError(null);
    void renderDiagram(normalizedSource, normalizedSource).then(
      (rendered) => {
        if (active) setSvg(rendered);
      },
      (reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Invalid Mermaid diagram');
        }
      }
    );
    return () => {
      active = false;
    };
  }, [normalizedSource, retry]);

  if (error) {
    return (
      <div role="alert" className="my-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        <p>{error}</p>
        <button
          type="button"
          className="mt-2 rounded border border-destructive/40 px-2 py-1 font-medium hover:bg-destructive/10"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry diagram
        </button>
      </div>
    );
  }
  if (!svg) {
    return (
      <div role="status" className="my-4 rounded-md border border-border p-4 text-center text-xs text-muted-foreground">
        Rendering diagram…
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label="Mermaid diagram"
      className="my-4 overflow-x-auto rounded-md border border-border bg-white p-4 text-center [&_svg]:mx-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

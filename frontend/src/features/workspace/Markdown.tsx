import { useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CoreNote } from '@modulo/core';

interface MarkdownProps {
  content: string;
  notes: CoreNote[];
  onSelectNote: (id: number) => void;
}

const WIKI_PREFIX = '#wiki:';

// Rewrites [[Note Title]] into markdown links the custom <a> renderer can
// resolve, so wiki-links stay navigable without raw HTML / sanitization risk.
function preprocess(content: string, notes: CoreNote[]): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_match, title: string) => {
    const note = notes.find((n) => n.title === title.trim());
    const target = note ? String(note.id) : 'missing';
    return `[${title}](${WIKI_PREFIX}${target})`;
  });
}

export function Markdown({ content, notes, onSelectNote }: MarkdownProps) {
  const processed = useMemo(() => preprocess(content || '', notes), [content, notes]);

  return (
    <div className="text-[13.5px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _n, ...props }) => (
            <h1 className="mb-4 text-[22px] font-semibold leading-snug tracking-tight text-foreground" {...props} />
          ),
          h2: ({ node: _n, ...props }) => (
            <h2 className="mb-2.5 mt-7 text-base font-semibold tracking-tight text-foreground" {...props} />
          ),
          h3: ({ node: _n, ...props }) => (
            <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground" {...props} />
          ),
          p: ({ node: _n, ...props }) => (
            <p className="mb-3.5 leading-[1.75] text-foreground/90" {...props} />
          ),
          strong: ({ node: _n, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
          em: ({ node: _n, ...props }) => <em className="text-subtle-foreground" {...props} />,
          code: ({ node: _n, ...props }) => (
            <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[12.5px] text-primary-hover" {...props} />
          ),
          pre: ({ node: _n, ...props }) => (
            <pre
              className="mb-4 overflow-x-auto rounded-lg border border-border-strong bg-surface px-5 py-4 [&_code]:bg-transparent [&_code]:p-0 [&_code]:leading-relaxed [&_code]:text-subtle-foreground"
              {...props}
            />
          ),
          ul: ({ node: _n, ...props }) => (
            <ul className="mb-3.5 list-disc pl-[22px] leading-[1.75] text-foreground/90 [&_li]:mb-1" {...props} />
          ),
          ol: ({ node: _n, ...props }) => (
            <ol className="mb-3.5 list-decimal pl-[22px] leading-[1.75] text-foreground/90 [&_li]:mb-1" {...props} />
          ),
          input: ({ node: _n, ...props }) => <input className="mr-1.5 accent-primary" {...props} />,
          blockquote: ({ node: _n, ...props }) => (
            <blockquote
              className="mb-3.5 rounded-r-md border-l-[3px] border-primary bg-primary/5 px-4 py-2 text-subtle-foreground"
              {...props}
            />
          ),
          hr: ({ node: _n, ...props }) => <hr className="my-5 border-0 border-t border-border-strong" {...props} />,
          table: ({ node: _n, ...props }) => (
            <table className="mb-3.5 w-full border-collapse text-[13px]" {...props} />
          ),
          th: ({ node: _n, ...props }) => (
            <th className="border border-border-strong bg-surface-3 px-3 py-2 text-left font-medium text-foreground" {...props} />
          ),
          td: ({ node: _n, ...props }) => (
            <td className="border border-border px-3 py-1.5 text-subtle-foreground" {...props} />
          ),
          a({ href, children }: { href?: string; children?: ReactNode }) {
            if (href && href.startsWith(WIKI_PREFIX)) {
              const ref = href.slice(WIKI_PREFIX.length);
              if (ref === 'missing') {
                return <span className="text-warning">{children}</span>;
              }
              const id = Number(ref);
              return (
                <button
                  type="button"
                  onClick={() => onSelectNote(id)}
                  className="rounded-sm border-b border-primary/40 text-primary-hover transition-colors hover:border-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {children}
                </button>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="rounded-sm border-b border-primary/40 text-primary-hover transition-colors hover:border-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

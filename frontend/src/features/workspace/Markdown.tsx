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
    <div className="mdv">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }: { href?: string; children?: ReactNode }) {
            if (href && href.startsWith(WIKI_PREFIX)) {
              const ref = href.slice(WIKI_PREFIX.length);
              if (ref === 'missing') {
                return <span style={{ color: '#f59e0b' }}>{children}</span>;
              }
              const id = Number(ref);
              return (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectNote(id);
                  }}
                  style={{ color: '#818cf8', textDecoration: 'none', borderBottom: '1px solid rgba(129,140,248,.35)' }}
                >
                  {children}
                </a>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
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

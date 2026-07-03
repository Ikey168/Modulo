import { isValidElement, useMemo, type ComponentType, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CoreNote } from '@modulo/core';
import { nodeText, parseWikiRef, slugify } from './outline';
import type { NoteFenceContribution, NoteFenceProps } from './plugins/types';

/** Slug id + scroll margin so the Outline plugin can jump to a heading. */
function headingId(children: ReactNode): string {
  return slugify(nodeText(children));
}

interface MarkdownProps {
  content: string;
  notes: CoreNote[];
  onSelectNote: (id: number) => void;
  /** Called when a link to a non-existent note is clicked (Obsidian-style). */
  onCreateNote?: (title: string) => void;
  /** Fence renderers contributed by installed plugins (keyed by ```language). */
  fences?: NoteFenceContribution[];
}

const WIKI_PREFIX = '#wiki:';
const HEAD_PREFIX = '#wiki-head:';
const NEW_PREFIX = '#wiki-new:';

/** The fenced language from a code element's `language-xxx` class, if any. */
function languageOf(className: string | undefined): string | null {
  const m = /\blanguage-([\w-]+)\b/.exec(className ?? '');
  return m ? m[1] : null;
}
function fenceLanguageOf(node: ReactNode): string | null {
  const child = Array.isArray(node) ? node[0] : node;
  if (!isValidElement(child)) return null;
  return languageOf((child.props as { className?: string }).className);
}

/** Brackets would break the generated markdown link, so drop them from labels. */
const cleanLabel = (s: string) => s.replace(/[[\]]/g, '').trim();

// Rewrites Obsidian-style wiki-links into markdown links the custom <a>
// renderer can resolve, so they stay navigable without raw HTML / sanitization
// risk. Supports:
//   [[Note Title]]                 → link to a note by title
//   [[Note Title|Alias]]           → same, with custom display text
//   [[Note Title#Heading]]         → link to a note (heading kept in the label)
//   [[#Heading]]                   → jump to a heading in the current note
function preprocess(content: string, notes: CoreNote[]): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
    const { target, heading, alias } = parseWikiRef(inner);

    // In-note heading link: [[#Heading]]
    if (!target && heading) {
      const label = cleanLabel(alias || heading);
      return `[${label}](${HEAD_PREFIX}${slugify(heading)})`;
    }
    const note = notes.find((n) => n.title === target);
    if (!note) {
      const label = cleanLabel(alias || (heading ? `${target}#${heading}` : target));
      // Encode the real target title so a click can create that note.
      return `[${label}](${NEW_PREFIX}${encodeURIComponent(target)})`;
    }
    const label = cleanLabel(alias || (heading ? `${target} › ${heading}` : target));
    return `[${label}](${WIKI_PREFIX}${note.id})`;
  });
}

/** Drops react-markdown's hast `node` prop so the rest can spread onto DOM elements. */
function strip<P extends { node?: unknown }>(props: P): Omit<P, 'node'> {
  const rest = { ...props };
  delete rest.node;
  return rest as Omit<P, 'node'>;
}

const LINK_CLASSES =
  'rounded-sm border-b border-primary/40 text-primary-hover transition-colors hover:border-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
// Unresolved link: dashed amber, becomes a real link once the note is created.
const NEW_LINK_CLASSES =
  'rounded-sm border-b border-dashed border-warning/50 text-warning transition-colors hover:border-warning hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function Markdown({ content, notes, onSelectNote, onCreateNote, fences }: MarkdownProps) {
  const processed = useMemo(() => preprocess(content || '', notes), [content, notes]);
  const fenceMap = useMemo(() => {
    const map = new Map<string, ComponentType<NoteFenceProps>>();
    for (const f of fences ?? []) map.set(f.language, f.component);
    return map;
  }, [fences]);

  return (
    <div className="text-[13.5px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1 id={headingId(props.children)} className="mb-4 mt-2 scroll-mt-6 text-[30px] font-bold leading-[1.15] tracking-tight text-foreground first:mt-0" {...strip(props)} />
          ),
          h2: (props) => (
            <h2 id={headingId(props.children)} className="mb-3 mt-9 scroll-mt-6 text-[23px] font-semibold leading-tight tracking-tight text-foreground" {...strip(props)} />
          ),
          h3: (props) => (
            <h3 id={headingId(props.children)} className="mb-2 mt-7 scroll-mt-6 text-[18px] font-semibold tracking-tight text-foreground" {...strip(props)} />
          ),
          h4: (props) => (
            <h4 id={headingId(props.children)} className="mb-1.5 mt-5 scroll-mt-6 text-[15px] font-semibold text-foreground" {...strip(props)} />
          ),
          h5: (props) => (
            <h5 id={headingId(props.children)} className="mb-1 mt-4 scroll-mt-6 text-[13px] font-semibold uppercase tracking-wide text-subtle-foreground" {...strip(props)} />
          ),
          h6: (props) => (
            <h6 id={headingId(props.children)} className="mb-1 mt-4 scroll-mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground" {...strip(props)} />
          ),
          p: (props) => <p className="mb-3.5 leading-[1.75] text-foreground/90" {...strip(props)} />,
          strong: (props) => <strong className="font-semibold text-foreground" {...strip(props)} />,
          em: (props) => <em className="text-subtle-foreground" {...strip(props)} />,
          code: (props) => {
            const lang = languageOf((props as { className?: string }).className);
            const Fence = lang ? fenceMap.get(lang) : undefined;
            if (Fence) {
              return <Fence source={nodeText(props.children)} />;
            }
            return (
              <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[12.5px] text-primary-hover" {...strip(props)} />
            );
          },
          pre: (props) => {
            // A plugin fence (e.g. ```database) renders as a full-width surface,
            // so shed the <pre> code chrome and let it stand on its own.
            const fenceLang = fenceLanguageOf(props.children);
            if (fenceLang && fenceMap.has(fenceLang)) {
              return <>{props.children}</>;
            }
            return (
              <pre
                className="mb-4 overflow-x-auto rounded-lg border border-border-strong bg-surface px-5 py-4 [&_code]:bg-transparent [&_code]:p-0 [&_code]:leading-relaxed [&_code]:text-subtle-foreground"
                {...strip(props)}
              />
            );
          },
          ul: (props) => (
            <ul className="mb-3.5 list-disc pl-[22px] leading-[1.75] text-foreground/90 [&_li]:mb-1" {...strip(props)} />
          ),
          ol: (props) => (
            <ol className="mb-3.5 list-decimal pl-[22px] leading-[1.75] text-foreground/90 [&_li]:mb-1" {...strip(props)} />
          ),
          input: (props) => <input className="mr-1.5 accent-primary" {...strip(props)} />,
          blockquote: (props) => (
            <blockquote
              className="mb-3.5 rounded-r-md border-l-[3px] border-primary bg-primary/5 px-4 py-2 text-subtle-foreground"
              {...strip(props)}
            />
          ),
          hr: (props) => <hr className="my-5 border-0 border-t border-border-strong" {...strip(props)} />,
          table: (props) => <table className="mb-3.5 w-full border-collapse text-[13px]" {...strip(props)} />,
          th: (props) => (
            <th className="border border-border-strong bg-surface-3 px-3 py-2 text-left font-medium text-foreground" {...strip(props)} />
          ),
          td: (props) => <td className="border border-border px-3 py-1.5 text-subtle-foreground" {...strip(props)} />,
          a({ href, children }: { href?: string; children?: ReactNode }) {
            if (href && href.startsWith(HEAD_PREFIX)) {
              const slug = href.slice(HEAD_PREFIX.length);
              return (
                <button
                  type="button"
                  onClick={() => document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={LINK_CLASSES}
                >
                  {children}
                </button>
              );
            }
            if (href && href.startsWith(NEW_PREFIX)) {
              const title = decodeURIComponent(href.slice(NEW_PREFIX.length));
              if (!onCreateNote || !title) {
                return <span className="text-warning">{children}</span>;
              }
              return (
                <button
                  type="button"
                  onClick={() => onCreateNote(title)}
                  title={`Create note “${title}”`}
                  className={NEW_LINK_CLASSES}
                >
                  {children}
                </button>
              );
            }
            if (href && href.startsWith(WIKI_PREFIX)) {
              const ref = href.slice(WIKI_PREFIX.length);
              if (ref === 'missing') {
                return <span className="text-warning">{children}</span>;
              }
              const id = Number(ref);
              return (
                <button type="button" onClick={() => onSelectNote(id)} className={LINK_CLASSES}>
                  {children}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer" className={LINK_CLASSES}>
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

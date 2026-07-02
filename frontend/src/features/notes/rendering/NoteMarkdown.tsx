/**
 * Sanitized note-content rendering pipeline.
 *
 * - Markdown renders through react-markdown + remark-gfm. react-markdown never
 *   injects raw HTML by default, so this path is XSS-safe by construction.
 * - When `allowHtml` is set (renderer output that legitimately contains HTML),
 *   raw HTML is parsed by rehype-raw and then scrubbed by rehype-sanitize with
 *   the GitHub-style default schema (strips <script>, <iframe>, inline event
 *   handlers, javascript: URLs, …) before anything reaches the DOM.
 *
 * All element styling is expressed with design-system tokens.
 */

import React from 'react';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { PluggableList } from 'unified';
import { cn } from '@/ui';

const MARKDOWN_PLUGINS: PluggableList = [remarkGfm];

/** rehype-raw parses raw HTML; rehype-sanitize (default schema) scrubs it. */
const SANITIZED_HTML_PLUGINS: PluggableList = [rehypeRaw, [rehypeSanitize, defaultSchema]];

/** Build a component override that renders `Tag` with token-styled classes. */
function styled<T extends keyof React.JSX.IntrinsicElements>(Tag: T, classes: string) {
  const Component = (props: React.JSX.IntrinsicElements[T] & ExtraProps) => {
    // react-markdown passes a `node` prop we must not forward to the DOM.
    const { node, className, ...rest } = props as ExtraProps & {
      className?: string;
    } & Record<string, unknown>;
    void node;
    return React.createElement(Tag, { ...rest, className: cn(classes, className) });
  };
  Component.displayName = `Markdown(${Tag})`;
  return Component;
}

const markdownComponents: Components = {
  h1: styled('h1', 'mb-3 mt-6 border-b border-border pb-2 text-2xl font-semibold tracking-tight text-foreground first:mt-0'),
  h2: styled('h2', 'mb-2.5 mt-6 text-xl font-semibold tracking-tight text-foreground first:mt-0'),
  h3: styled('h3', 'mb-2 mt-5 text-lg font-semibold text-foreground first:mt-0'),
  h4: styled('h4', 'mb-2 mt-4 text-base font-semibold text-foreground first:mt-0'),
  h5: styled('h5', 'mb-1.5 mt-4 text-sm font-semibold text-foreground first:mt-0'),
  h6: styled('h6', 'mb-1.5 mt-4 text-sm font-semibold text-muted-foreground first:mt-0'),
  p: styled('p', 'my-3 text-sm leading-relaxed first:mt-0 last:mb-0'),
  a: styled('a', 'font-medium text-primary-hover underline-offset-2 hover:underline'),
  strong: styled('strong', 'font-semibold text-foreground'),
  ul: styled('ul', 'my-3 flex list-disc flex-col gap-1 pl-6 text-sm leading-relaxed'),
  ol: styled('ol', 'my-3 flex list-decimal flex-col gap-1 pl-6 text-sm leading-relaxed'),
  li: styled('li', 'marker:text-muted-foreground'),
  blockquote: styled(
    'blockquote',
    'my-4 border-l-[3px] border-primary bg-surface-2/60 py-1.5 pl-4 pr-3 text-sm text-muted-foreground [&>p]:my-1.5',
  ),
  code: styled('code', 'rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[0.9em] text-subtle-foreground'),
  pre: styled(
    'pre',
    'my-4 overflow-x-auto rounded-md border border-border bg-surface-3 p-4 font-mono text-[13px] leading-relaxed text-subtle-foreground ' +
      '[&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit',
  ),
  hr: styled('hr', 'my-6 border-border'),
  img: styled('img', 'my-3 h-auto max-w-full rounded-md border border-border'),
  table: styled('table', 'my-4 block w-max max-w-full border-collapse overflow-x-auto text-[13px]'),
  thead: styled('thead', 'bg-surface-2'),
  th: styled('th', 'border border-border-strong px-3 py-1.5 text-left font-semibold text-foreground'),
  td: styled('td', 'border border-border px-3 py-1.5 align-top text-subtle-foreground'),
  input: styled('input', 'mr-1.5 size-3.5 translate-y-px accent-primary'),
};

export interface NoteMarkdownProps {
  content: string;
  /**
   * Allow raw HTML embedded in the content. It is always sanitized
   * (rehype-raw → rehype-sanitize) before rendering — never injected as-is.
   */
  allowHtml?: boolean;
  className?: string;
}

/** Token-styled, sanitized markdown (and optionally HTML) renderer. */
export function NoteMarkdown({ content, allowHtml = false, className }: NoteMarkdownProps) {
  return (
    <div className={cn('text-sm leading-relaxed text-subtle-foreground', className)}>
      <ReactMarkdown
        remarkPlugins={MARKDOWN_PLUGINS}
        rehypePlugins={allowHtml ? SANITIZED_HTML_PLUGINS : undefined}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default NoteMarkdown;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/ui';
import { NoteTemplate } from './templateApi';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
  insert: string | ((query: string) => string);
}

const BUILT_IN_COMMANDS: SlashCommand[] = [
  { id: 'h1',       label: 'Heading 1',    description: 'Large section heading',     icon: 'H1', insert: '# ' },
  { id: 'h2',       label: 'Heading 2',    description: 'Medium section heading',    icon: 'H2', insert: '## ' },
  { id: 'h3',       label: 'Heading 3',    description: 'Small section heading',     icon: 'H3', insert: '### ' },
  { id: 'bullet',   label: 'Bullet list',  description: 'Unordered list',            icon: '•',  insert: '- ' },
  { id: 'numbered', label: 'Numbered list',description: 'Ordered list',              icon: '1.',  insert: '1. ' },
  { id: 'task',     label: 'Task item',    description: 'Checkbox task',             icon: '☐',  insert: '- [ ] ' },
  { id: 'code',     label: 'Code block',   description: 'Fenced code block',         icon: '</>',  insert: '```\n\n```\n' },
  { id: 'quote',    label: 'Blockquote',   description: 'Highlighted quote',         icon: '"',  insert: '> ' },
  { id: 'divider',  label: 'Divider',      description: 'Horizontal rule',           icon: '—',  insert: '\n---\n' },
  { id: 'date',     label: 'Today\'s date',description: 'Insert current date',       icon: '📅', insert: () => new Date().toLocaleDateString() },
  { id: 'callout',  label: 'Callout',      description: 'Info/warning callout',      icon: '💡', insert: '> **Note:** ' },
  { id: 'table',    label: 'Table',        description: 'Simple markdown table',     icon: '⊞',  insert: '| Column 1 | Column 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n' },
];

interface Props {
  query: string;
  position: { top: number; left: number };
  templates: NoteTemplate[];
  onSelect: (insert: string) => void;
  onClose: () => void;
}

const SlashCommandMenu: React.FC<Props> = ({ query, position, templates, onSelect, onClose }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const templateCommands: SlashCommand[] = templates.map(t => ({
    id: `template-${t.id}`,
    label: t.name,
    description: t.description ?? 'Template',
    icon: '📄',
    insert: t.content,
  }));

  const allCommands = [...BUILT_IN_COMMANDS, ...templateCommands];

  const filtered = query
    ? allCommands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands;

  useEffect(() => { setActiveIdx(0); }, [query]);

  const execCommand = useCallback((cmd: SlashCommand) => {
    const text = typeof cmd.insert === 'function' ? cmd.insert(query) : cmd.insert;
    onSelect(text);
  }, [query, onSelect]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && filtered[activeIdx]) { e.preventDefault(); e.stopPropagation(); execCommand(filtered[activeIdx]); }
      if (e.key === 'Escape')    { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [filtered, activeIdx, execCommand, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{ top: position.top, left: position.left }}
      className="fixed z-[2000] max-h-80 w-[260px] animate-scale-in overflow-y-auto rounded-lg border border-border-strong bg-popover text-popover-foreground shadow-lg"
    >
      {query === '' && (
        <div className="border-b border-border px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">
          COMMANDS
        </div>
      )}
      {filtered.map((cmd, i) => (
        <div
          key={cmd.id}
          onClick={() => execCommand(cmd)}
          className={cn(
            'flex cursor-pointer items-center gap-2.5 border-l-[3px] px-3 py-2 transition-colors',
            i === activeIdx
              ? 'border-primary bg-surface-2'
              : 'border-transparent',
          )}
          onMouseEnter={() => setActiveIdx(i)}
        >
          <span className="w-7 shrink-0 text-center text-[13px] font-bold text-muted-foreground">
            {cmd.icon}
          </span>
          <div>
            <div className="text-[13px] font-medium text-foreground">{cmd.label}</div>
            <div className="text-[11px] text-muted-foreground">{cmd.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SlashCommandMenu;

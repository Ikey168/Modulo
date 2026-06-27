import React, { useState, useEffect, useRef, useCallback } from 'react';
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
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 2000,
        background: 'var(--color-surface, #fff)',
        border: '1px solid var(--color-border, #e5e7eb)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,.15)',
        width: '260px',
        maxHeight: '320px',
        overflowY: 'auto',
      }}
    >
      {query === '' && (
        <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)', borderBottom: '1px solid var(--color-border, #e5e7eb)' }}>
          COMMANDS
        </div>
      )}
      {filtered.map((cmd, i) => (
        <div
          key={cmd.id}
          onClick={() => execCommand(cmd)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            cursor: 'pointer',
            background: i === activeIdx ? 'var(--color-primary-subtle, #eff6ff)' : 'transparent',
            borderLeft: i === activeIdx ? '3px solid var(--color-primary, #3b82f6)' : '3px solid transparent',
          }}
          onMouseEnter={() => setActiveIdx(i)}
        >
          <span style={{ width: '28px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }}>
            {cmd.icon}
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>{cmd.label}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)' }}>{cmd.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SlashCommandMenu;

// Obsidian Outline — contributes a document-outline panel to the note details
// column. Depends on Markdown Notes (there is no note view without it).
import { parseHeadings } from '../../outline';
import type { NotePanelProps, PluginModule } from '../types';

function OutlinePanel({ note }: NotePanelProps) {
  const headings = parseHeadings(note.markdownContent ?? note.content ?? '');
  if (headings.length === 0) {
    return <p className="px-0.5 py-1 text-xs text-muted-foreground">No headings yet.</p>;
  }
  return (
    <nav aria-label="Document outline" className="-mx-1 flex flex-col">
      {headings.map((h, i) => (
        <button
          key={`${h.slug}-${i}`}
          type="button"
          onClick={() => document.getElementById(h.slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          style={{ paddingLeft: `${(h.level - 1) * 12 + 4}px` }}
          className="truncate rounded-sm py-1 pr-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          title={h.text}
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}

const outlinePlugin: PluginModule = {
  activate(ctx) {
    ctx.addNotePanel({ id: 'outline', title: 'Outline', order: 0, component: OutlinePanel });
  },
};

export default outlinePlugin;

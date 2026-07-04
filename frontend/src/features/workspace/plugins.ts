// Sample marketplace catalogue. The plugin store is not yet wired to a backend
// endpoint, so this list is static and install state is kept client-side.
import {
  CalendarClock,
  CalendarDays,
  ChartNetwork,
  FileDown,
  FileText,
  Fingerprint,
  Frame,
  Github,
  Link2,
  ListTree,
  Paperclip,
  ScanSearch,
  Sigma,
  Sparkles,
  SquareKanban,
  Stamp,
  Table2,
  Timer,
  Waypoints,
  Webhook,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export interface PluginInfo {
  id: string;
  name: string;
  desc: string;
  category: string;
  /** Optional second-level grouping, shown nested under the category. */
  subcategory?: string;
  downloads: string;
  rating: string;
  icon: LucideIcon;
}

/** Plugin id that gates the workspace Graph view (pre-installed by default). */
export const GRAPH_PLUGIN_ID = 'graph-view';
/** Plugin id that gates the workspace Notes editor (pre-installed by default). */
export const NOTES_PLUGIN_ID = 'notes-editor';
/** Plugin id that adds the Obsidian-style document outline to the note view. */
export const OUTLINE_PLUGIN_ID = 'obsidian-outline';
/** Plugin id that renders ```database fences as Notion-style embedded tables. */
export const DATABASE_PLUGIN_ID = 'notion-database';
/** Plugin id that adds the freeform Canvas board view. */
export const CANVAS_PLUGIN_ID = 'canvas-board';

export const PLUGINS: PluginInfo[] = [
  { id: NOTES_PLUGIN_ID, name: 'Markdown Notes', desc: 'Markdown editor with wiki-style [[links]], tags and on-chain anchoring.', category: 'productivity', subcategory: 'Writing', downloads: '24.1k', rating: '4.9', icon: FileText },
  { id: OUTLINE_PLUGIN_ID, name: 'Obsidian Outline', desc: 'Obsidian-style document outline plus in-note heading links: jump between a note’s headings.', category: 'productivity', subcategory: 'Writing', downloads: '13.2k', rating: '4.8', icon: ListTree },
  { id: DATABASE_PLUGIN_ID, name: 'Embedded Databases', desc: 'Notion-style databases inside a note: typed columns, a table and a board view, edited inline.', category: 'productivity', subcategory: 'Organizing', downloads: '16.7k', rating: '4.8', icon: Table2 },
  { id: GRAPH_PLUGIN_ID, name: 'Knowledge Graph', desc: 'Interactive force-directed graph of your notes and their links.', category: 'analytics', subcategory: 'Visualization', downloads: '18.6k', rating: '4.9', icon: Waypoints },
  { id: CANVAS_PLUGIN_ID, name: 'Canvas', desc: 'Freeform board: arrange note cards spatially and draw connections between them.', category: 'productivity', subcategory: 'Whiteboard', downloads: '7.3k', rating: '4.7', icon: Frame },
  { id: 'latex', name: 'LaTeX Math', desc: 'Render mathematical equations inline and in blocks using KaTeX.', category: 'render', subcategory: 'Math', downloads: '12.4k', rating: '4.8', icon: Sigma },
  { id: 'ai-summary', name: 'AI Summarizer', desc: 'Generate concise note summaries powered by GPT-4.', category: 'ai', subcategory: 'Writing', downloads: '8.9k', rating: '4.6', icon: Sparkles },
  { id: 'github-sync', name: 'GitHub Sync', desc: 'Automatically back up and sync your notes to a GitHub repository.', category: 'sync', downloads: '15.2k', rating: '4.9', icon: Github },
  { id: 'mermaid', name: 'Mermaid Diagrams', desc: 'Create flowcharts and sequence diagrams using Mermaid syntax.', category: 'render', subcategory: 'Diagrams', downloads: '6.7k', rating: '4.5', icon: Workflow },
  { id: 'pdf-export', name: 'PDF Export', desc: 'Export individual notes or entire notebooks as formatted PDF documents.', category: 'export', downloads: '9.1k', rating: '4.3', icon: FileDown },
  { id: 'graph-stats', name: 'Graph Analytics', desc: 'Advanced graph analytics: centrality scores, cluster detection, and more.', category: 'analytics', subcategory: 'Metrics', downloads: '3.2k', rating: '4.7', icon: ChartNetwork },
  { id: 'web3-id', name: 'Web3 Identity', desc: 'Sign notes with your Ethereum wallet for verifiable on-chain authorship.', category: 'web3', subcategory: 'Identity', downloads: '4.5k', rating: '4.4', icon: Fingerprint },
  { id: 'focus', name: 'Focus Timer', desc: 'Built-in Pomodoro timer that logs focus sessions linked to your notes.', category: 'productivity', subcategory: 'Focus', downloads: '7.8k', rating: '4.2', icon: Timer },
  { id: 'ipfs-attach', name: 'IPFS Attachments', desc: 'Pin images and files to IPFS; notes reference content by CID.', category: 'web3', subcategory: 'Storage', downloads: '5.6k', rating: '4.5', icon: Paperclip },
  { id: 'timestamp-proofs', name: 'Timestamp Proofs', desc: 'OpenTimestamps proofs for notes without a full on-chain anchor.', category: 'web3', subcategory: 'Proofs', downloads: '2.4k', rating: '4.3', icon: Stamp },
  { id: 'webhook-trigger', name: 'Webhook Trigger', desc: 'Start a blueprint workflow from an inbound webhook.', category: 'automation', subcategory: 'Triggers', downloads: '6.1k', rating: '4.6', icon: Webhook },
  { id: 'scheduled-digest', name: 'Scheduled Digest', desc: 'Email or post a daily or weekly summary of note changes.', category: 'automation', subcategory: 'Scheduled', downloads: '4.9k', rating: '4.4', icon: CalendarClock },
  { id: 'semantic-search', name: 'Semantic Search', desc: 'Vector search across your whole vault, powered by embeddings.', category: 'ai', subcategory: 'Search', downloads: '11.3k', rating: '4.7', icon: ScanSearch },
  { id: 'auto-linker', name: 'Auto-Linker', desc: 'Suggest [[wiki-links]] between notes from embedding similarity.', category: 'ai', subcategory: 'Writing', downloads: '8.2k', rating: '4.5', icon: Link2 },
  { id: 'daily-notes', name: 'Daily Notes', desc: 'Automatically create a dated journal note each day.', category: 'productivity', subcategory: 'Journaling', downloads: '10.4k', rating: '4.8', icon: CalendarDays },
  { id: 'kanban', name: 'Kanban Board', desc: 'Turn note checklists into drag-and-drop task boards.', category: 'productivity', subcategory: 'Organizing', downloads: '9.7k', rating: '4.6', icon: SquareKanban },
];

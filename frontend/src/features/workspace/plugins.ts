// Sample marketplace catalogue. The plugin store is not yet wired to a backend
// endpoint, so this list is static and install state is kept client-side.
import {
  CalendarClock,
  CalendarDays,
  ChartNetwork,
  FileDown,
  FileText,
  Fingerprint,
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
  author: string;
  desc: string;
  category: string;
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

export const PLUGINS: PluginInfo[] = [
  { id: NOTES_PLUGIN_ID, name: 'Markdown Notes', author: 'Modulo Labs', desc: 'Markdown editor with wiki-style [[links]], tags and on-chain anchoring.', category: 'productivity', downloads: '24.1k', rating: '4.9', icon: FileText },
  { id: OUTLINE_PLUGIN_ID, name: 'Obsidian Outline', author: 'Modulo Labs', desc: 'Obsidian-style document outline plus in-note heading links: jump between a note’s headings.', category: 'productivity', downloads: '13.2k', rating: '4.8', icon: ListTree },
  { id: DATABASE_PLUGIN_ID, name: 'Embedded Databases', author: 'Modulo Labs', desc: 'Notion-style databases inside a note: typed columns, a table and a board view, edited inline.', category: 'productivity', downloads: '16.7k', rating: '4.8', icon: Table2 },
  { id: GRAPH_PLUGIN_ID, name: 'Knowledge Graph', author: 'Modulo Labs', desc: 'Interactive force-directed graph of your notes and their links.', category: 'analytics', downloads: '18.6k', rating: '4.9', icon: Waypoints },
  { id: 'latex', name: 'LaTeX Math', author: 'Modulo Labs', desc: 'Render mathematical equations inline and in blocks using KaTeX.', category: 'render', downloads: '12.4k', rating: '4.8', icon: Sigma },
  { id: 'ai-summary', name: 'AI Summarizer', author: 'OpenMind', desc: 'Generate concise note summaries powered by GPT-4.', category: 'ai', downloads: '8.9k', rating: '4.6', icon: Sparkles },
  { id: 'github-sync', name: 'GitHub Sync', author: 'devmode', desc: 'Automatically back up and sync your notes to a GitHub repository.', category: 'sync', downloads: '15.2k', rating: '4.9', icon: Github },
  { id: 'mermaid', name: 'Mermaid Diagrams', author: 'Modulo Labs', desc: 'Create flowcharts and sequence diagrams using Mermaid syntax.', category: 'render', downloads: '6.7k', rating: '4.5', icon: Workflow },
  { id: 'pdf-export', name: 'PDF Export', author: 'paperworks', desc: 'Export individual notes or entire notebooks as formatted PDF documents.', category: 'export', downloads: '9.1k', rating: '4.3', icon: FileDown },
  { id: 'graph-stats', name: 'Graph Analytics', author: 'nodelab', desc: 'Advanced graph analytics: centrality scores, cluster detection, and more.', category: 'analytics', downloads: '3.2k', rating: '4.7', icon: ChartNetwork },
  { id: 'web3-id', name: 'Web3 Identity', author: 'Modulo Labs', desc: 'Sign notes with your Ethereum wallet for verifiable on-chain authorship.', category: 'web3', downloads: '4.5k', rating: '4.4', icon: Fingerprint },
  { id: 'focus', name: 'Focus Timer', author: 'deepwork', desc: 'Built-in Pomodoro timer that logs focus sessions linked to your notes.', category: 'productivity', downloads: '7.8k', rating: '4.2', icon: Timer },
  { id: 'ipfs-attach', name: 'IPFS Attachments', author: 'Modulo Labs', desc: 'Pin images and files to IPFS; notes reference content by CID.', category: 'web3', downloads: '5.6k', rating: '4.5', icon: Paperclip },
  { id: 'timestamp-proofs', name: 'Timestamp Proofs', author: 'chainmark', desc: 'OpenTimestamps proofs for notes without a full on-chain anchor.', category: 'web3', downloads: '2.4k', rating: '4.3', icon: Stamp },
  { id: 'webhook-trigger', name: 'Webhook Trigger', author: 'Modulo Labs', desc: 'Start a blueprint workflow from an inbound webhook.', category: 'automation', downloads: '6.1k', rating: '4.6', icon: Webhook },
  { id: 'scheduled-digest', name: 'Scheduled Digest', author: 'deepwork', desc: 'Email or post a daily or weekly summary of note changes.', category: 'automation', downloads: '4.9k', rating: '4.4', icon: CalendarClock },
  { id: 'semantic-search', name: 'Semantic Search', author: 'OpenMind', desc: 'Vector search across your whole vault, powered by embeddings.', category: 'ai', downloads: '11.3k', rating: '4.7', icon: ScanSearch },
  { id: 'auto-linker', name: 'Auto-Linker', author: 'OpenMind', desc: 'Suggest [[wiki-links]] between notes from embedding similarity.', category: 'ai', downloads: '8.2k', rating: '4.5', icon: Link2 },
  { id: 'daily-notes', name: 'Daily Notes', author: 'paperworks', desc: 'Automatically create a dated journal note each day.', category: 'productivity', downloads: '10.4k', rating: '4.8', icon: CalendarDays },
  { id: 'kanban', name: 'Kanban Board', author: 'nodelab', desc: 'Turn note checklists into drag-and-drop task boards.', category: 'productivity', downloads: '9.7k', rating: '4.6', icon: SquareKanban },
];

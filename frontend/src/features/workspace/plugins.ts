// Sample marketplace catalogue. The plugin store is not yet wired to a backend
// endpoint, so this list is static and install state is kept client-side.
import {
  Archive,
  BookOpen,
  BookText,
  Bug,
  CalendarClock,
  CalendarDays,
  ChartNetwork,
  FileDown,
  FileText,
  Fingerprint,
  FolderSearch,
  Frame,
  Github,
  History,
  Link2,
  ListChecks,
  ListTodo,
  ListTree,
  Paperclip,
  ReceiptText,
  ScanSearch,
  ScrollText,
  Sigma,
  Sparkles,
  SquareKanban,
  Stamp,
  Table2,
  Tags,
  Timer,
  Waypoints,
  Webhook,
  Workflow,
  type LucideIcon,
  Newspaper,
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
/** Plugin id that adds the Calendar view (notes on a month/week grid). */
export const CALENDAR_PLUGIN_ID = 'calendar-view';
/** Plugin id that adds the Timeline view (notes as a chronological stream). */
export const TIMELINE_PLUGIN_ID = 'timeline-view';
/** Plugin id that adds the Tag Explorer (nested tag tree that filters notes). */
export const TAGS_PLUGIN_ID = 'tag-explorer';
/** Plugin id that adds Saved Searches (named smart folders). */
export const SAVED_SEARCHES_PLUGIN_ID = 'saved-searches';
/** Plugin id for the audit Findings Tracker (finding fence + dashboard). */
export const FINDINGS_PLUGIN_ID = 'findings-tracker';
/** Plugin id for audit methodology checklists (templates + progress panel). */
export const CHECKLISTS_PLUGIN_ID = 'audit-checklists';
/** Plugin id for the vulnerability knowledge base (class clusters + writeups). */
export const VULN_KB_PLUGIN_ID = 'vuln-kb';
/** Plugin id for the audit report generator (compile, export, anchor). */
export const REPORTS_PLUGIN_ID = 'audit-reports';
/** Plugin id for German invoicing (invoice fence, list, ZUGFeRD export). */
export const RECHNUNG_PLUGIN_ID = 'rechnung';
/** Plugin id for billable time tracking (Zeiterfassung). */
export const ZEITERFASSUNG_PLUGIN_ID = 'zeiterfassung';
/** Plugin id for EÜR bookkeeping + DATEV export. */
export const EUER_PLUGIN_ID = 'euer-datev';
/** Plugin id for the GoBD document vault (retention + anchored integrity). */
export const GOBD_PLUGIN_ID = 'gobd-vault';
/** Plugin id for Todo lists (tasks with due dates, priorities, note links). */
export const TODO_PLUGIN_ID = 'todo-lists';
/** Plugin id for German tax automation blueprint nodes. */
export const TAX_AUTOMATION_PLUGIN_ID = 'tax-automation';
/** Plugin id for the Noesis daily knowledge brief blueprint node. */
export const NOESIS_BRIEF_PLUGIN_ID = 'noesis-brief';

export const PLUGINS: PluginInfo[] = [
  { id: NOTES_PLUGIN_ID, name: 'Markdown Notes', desc: 'Markdown editor with wiki-style [[links]], tags and on-chain anchoring.', category: 'productivity', subcategory: 'Writing', downloads: '24.1k', rating: '4.9', icon: FileText },
  { id: OUTLINE_PLUGIN_ID, name: 'Obsidian Outline', desc: 'Obsidian-style document outline plus in-note heading links: jump between a note’s headings.', category: 'productivity', subcategory: 'Writing', downloads: '13.2k', rating: '4.8', icon: ListTree },
  { id: DATABASE_PLUGIN_ID, name: 'Embedded Databases', desc: 'Notion-style databases inside a note: typed columns, a table and a board view, edited inline.', category: 'productivity', subcategory: 'Organizing', downloads: '16.7k', rating: '4.8', icon: Table2 },
  { id: GRAPH_PLUGIN_ID, name: 'Knowledge Graph', desc: 'Interactive force-directed graph of your notes and their links.', category: 'analytics', subcategory: 'Visualization', downloads: '18.6k', rating: '4.9', icon: Waypoints },
  { id: CANVAS_PLUGIN_ID, name: 'Canvas', desc: 'Freeform board: arrange note cards spatially and draw connections between them.', category: 'productivity', subcategory: 'Whiteboard', downloads: '7.3k', rating: '4.7', icon: Frame },
  { id: CALENDAR_PLUGIN_ID, name: 'Calendar', desc: 'Browse notes on a month or week grid by their updated or created date.', category: 'productivity', subcategory: 'Planning', downloads: '9.4k', rating: '4.7', icon: CalendarDays },
  { id: TIMELINE_PLUGIN_ID, name: 'Timeline', desc: 'Notes as a chronological stream grouped by day, week, or month.', category: 'analytics', subcategory: 'Visualization', downloads: '6.8k', rating: '4.6', icon: History },
  { id: TAGS_PLUGIN_ID, name: 'Tag Explorer', desc: 'Browse nested tags as a tree with counts and filter notes by tag.', category: 'productivity', subcategory: 'Organizing', downloads: '8.1k', rating: '4.7', icon: Tags },
  { id: SAVED_SEARCHES_PLUGIN_ID, name: 'Saved Searches', desc: 'Save a query as a named smart folder that always reflects your notes.', category: 'productivity', subcategory: 'Search', downloads: '5.9k', rating: '4.6', icon: FolderSearch },
  { id: CHECKLISTS_PLUGIN_ID, name: 'Audit Checklists', desc: 'Methodology checklists per contract type (ERC-20, ERC-721, proxy, DeFi) with per-section progress in the note panel.', category: 'audit', subcategory: 'Methodology', downloads: '1.4k', rating: '4.8', icon: ListChecks },
  { id: RECHNUNG_PLUGIN_ID, name: 'Rechnung (German Invoicing)', desc: 'Invoices as ```invoice fences: §14 UStG field checks, VAT modes incl. reverse charge and §19, sequential numbering, ZUGFeRD (EN 16931) export.', category: 'business', subcategory: 'Invoicing', downloads: '2.3k', rating: '4.9', icon: ReceiptText },
  { id: REPORTS_PLUGIN_ID, name: 'Audit Reports', desc: 'Compile an engagement’s scope and findings into a report note; export to PDF or markdown and anchor the report on-chain.', category: 'audit', subcategory: 'Reports', downloads: '1.6k', rating: '4.9', icon: ScrollText },
  { id: VULN_KB_PLUGIN_ID, name: 'Vulnerability Knowledge Base', desc: 'Clusters classified findings (class: vuln/…) across engagements, links each class to its writeup note, and surfaces related findings on every note.', category: 'audit', subcategory: 'Knowledge', downloads: '1.1k', rating: '4.8', icon: BookOpen },
  { id: FINDINGS_PLUGIN_ID, name: 'Findings Tracker', desc: 'Structured audit findings inside notes (```finding fences) plus a cross-engagement dashboard with severity and status filters.', category: 'audit', subcategory: 'Findings', downloads: '1.9k', rating: '4.9', icon: Bug },
  { id: 'latex', name: 'LaTeX Math', desc: 'Render mathematical equations inline and in blocks using KaTeX.', category: 'render', subcategory: 'Math', downloads: '12.4k', rating: '4.8', icon: Sigma },
  { id: 'ai-summary', name: 'AI Summarizer', desc: 'Generate concise note summaries powered by GPT-4.', category: 'ai', subcategory: 'Writing', downloads: '8.9k', rating: '4.6', icon: Sparkles },
  { id: 'github-sync', name: 'GitHub Sync', desc: 'Automatically back up and sync your notes to a GitHub repository.', category: 'sync', downloads: '15.2k', rating: '4.9', icon: Github },
  { id: 'mermaid', name: 'Mermaid Diagrams', desc: 'Create flowcharts and sequence diagrams using Mermaid syntax.', category: 'render', subcategory: 'Diagrams', downloads: '6.7k', rating: '4.5', icon: Workflow },
  { id: 'pdf-export', name: 'PDF Export', desc: 'Export individual notes or entire notebooks as formatted PDF documents.', category: 'export', downloads: '9.1k', rating: '4.3', icon: FileDown },
  { id: 'graph-stats', name: 'Graph Analytics', desc: 'Advanced graph analytics: centrality scores, cluster detection, and more.', category: 'analytics', subcategory: 'Metrics', downloads: '3.2k', rating: '4.7', icon: ChartNetwork },
  { id: 'web3-id', name: 'Web3 Identity', desc: 'Sign notes with your Ethereum wallet for verifiable on-chain authorship.', category: 'web3', subcategory: 'Identity', downloads: '4.5k', rating: '4.4', icon: Fingerprint },
  { id: TAX_AUTOMATION_PLUGIN_ID, name: 'Tax Automation', desc: 'Blueprint nodes for the German tax rhythm: USt-VA/ZM deadline reminders, overdue-invoice chase drafts, VIES USt-IdNr checks.', category: 'business', subcategory: 'Automation', downloads: '0.9k', rating: '4.6', icon: CalendarClock },
  { id: GOBD_PLUGIN_ID, name: 'GoBD Vault', desc: 'Retention tracking for notes tagged retain/<class> with configurable periods, anchored-integrity status, and a Verfahrensdokumentation template.', category: 'business', subcategory: 'Compliance', downloads: '1.2k', rating: '4.6', icon: Archive },
  { id: EUER_PLUGIN_ID, name: 'Books (EÜR + DATEV)', desc: 'Income from paid invoices, expenses by category, USt-VA period numbers, and DATEV Buchungsstapel CSV export for your Steuerberater.', category: 'business', subcategory: 'Bookkeeping', downloads: '1.8k', rating: '4.7', icon: BookText },
  { id: ZEITERFASSUNG_PLUGIN_ID, name: 'Zeiterfassung (Time Tracking)', desc: 'Timer and manual entries per engagement; unbilled billable time converts into ```invoice line items.', category: 'business', subcategory: 'Time', downloads: '2.1k', rating: '4.7', icon: Timer },
  { id: 'focus', name: 'Focus Timer', desc: 'Built-in Pomodoro timer that logs focus sessions linked to your notes.', category: 'productivity', subcategory: 'Focus', downloads: '7.8k', rating: '4.2', icon: Timer },
  { id: 'ipfs-attach', name: 'IPFS Attachments', desc: 'Pin images and files to IPFS; notes reference content by CID.', category: 'web3', subcategory: 'Storage', downloads: '5.6k', rating: '4.5', icon: Paperclip },
  { id: 'timestamp-proofs', name: 'Timestamp Proofs', desc: 'OpenTimestamps proofs for notes without a full on-chain anchor.', category: 'web3', subcategory: 'Proofs', downloads: '2.4k', rating: '4.3', icon: Stamp },
  { id: 'webhook-trigger', name: 'Webhook Trigger', desc: 'Start a blueprint workflow from an inbound webhook.', category: 'automation', subcategory: 'Triggers', downloads: '6.1k', rating: '4.6', icon: Webhook },
  { id: NOESIS_BRIEF_PLUGIN_ID, name: 'Noesis Daily Brief', desc: 'Blueprint node that pulls the daily knowledge brief — news, economics, tech, web3, and new research publications, every line cited — from a Noesis instance; pair with On Schedule and Create Note to file it as a linked note.', category: 'automation', subcategory: 'Knowledge', downloads: '0.1k', rating: '4.8', icon: Newspaper },
  { id: 'scheduled-digest', name: 'Scheduled Digest', desc: 'Email or post a daily or weekly summary of note changes.', category: 'automation', subcategory: 'Scheduled', downloads: '4.9k', rating: '4.4', icon: CalendarClock },
  { id: 'semantic-search', name: 'Semantic Search', desc: 'Vector search across your whole vault, powered by embeddings.', category: 'ai', subcategory: 'Search', downloads: '11.3k', rating: '4.7', icon: ScanSearch },
  { id: 'auto-linker', name: 'Auto-Linker', desc: 'Suggest [[wiki-links]] between notes from embedding similarity.', category: 'ai', subcategory: 'Writing', downloads: '8.2k', rating: '4.5', icon: Link2 },
  { id: TODO_PLUGIN_ID, name: 'Todo Lists', desc: 'Tasks with due dates, priorities and lists, linkable to notes; filter by today, this week, or overdue.', category: 'productivity', subcategory: 'Tasks', downloads: '3.4k', rating: '4.7', icon: ListTodo },
  { id: 'daily-notes', name: 'Planner (Daily Notes)', desc: 'Dated journal notes grown into a planner: today view with carry-over of unfinished items, plus a week overview.', category: 'productivity', subcategory: 'Journaling', downloads: '10.4k', rating: '4.8', icon: CalendarDays },
  { id: 'kanban', name: 'Engagement Pipeline', desc: 'Drag-and-drop board: engagement notes move through configurable stages (Inquiry → Scoping → Audit → Report → Fix Review → Final).', category: 'audit', subcategory: 'Pipeline', downloads: '9.7k', rating: '4.6', icon: SquareKanban },
];

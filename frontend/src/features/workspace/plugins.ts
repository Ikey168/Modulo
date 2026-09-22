import { AWARENESS_PLUGINS } from './awareness/plugins';
import { RESEARCH_ROLES } from './researchRoles';
// Sample marketplace catalogue. The plugin store is not yet wired to a backend
// endpoint, so this list is static and install state is kept client-side.
import {
  Archive,
  ArrowDownToLine,
  BookCopy,
  BookOpen,
  BookText,
  BriefcaseBusiness,
  Bug,
  Building2,
  CalendarClock,
  CalendarDays,
  CircuitBoard,
  ChartNetwork,
  Clapperboard,
  ClipboardCheck,
  Compass,
  ContactRound,
  Cpu,
  Dumbbell,
  Dices as Dice20,
  FileDown,
  FileCheck2,
  FilePenLine,
  FileSignature,
  FileText,
  FlaskConical,
  Fingerprint,
  FolderSearch,
  FolderOpen,
  Frame,
  Gauge,
  Gamepad2,
  GitCompareArrows,
  Github,
  GraduationCap,
  Guitar,
  Headphones,
  History,
  Hammer,
  HeartPulse,
  Home,
  Link2,
  ListChecks,
  ListFilter,
  ListTodo,
  ListTree,
  LibraryBig,
  LayoutDashboard,
  Landmark,
  Layers3,
  MapPinned,
  Mail,
  Music2,
  Network,
  NotebookPen,
  PackageSearch,
  PanelsTopLeft,
  Palmtree,
  PartyPopper,
  Paperclip,
  Podcast,
  ReceiptText,
  Repeat2,
  PiggyBank,
  ScanSearch,
  ShieldAlert,
  ScrollText,
  Server,
  Sigma,
  Sparkles,
  ShoppingBag,
  Shirt,
  SquareKanban,
  Stamp,
  Table2,
  Tags,
  Timer,
  Utensils,
  WalletCards,
  Waypoints,
  Webhook,
  Workflow,
  Wrench,
  type LucideIcon,
  Newspaper,
  RefreshCw,
  Target,
  Theater,
  Tv,
  Youtube,
  Disc3, Feather, Camera, Palette, PenTool, Armchair, Paintbrush, Video, Film, MonitorPlay, Aperture, Globe, Projector, Radio, RadioTower, Disc, AudioLines, MessageSquareQuote, Presentation, MessagesSquare, BookAudio, Drama, Music4, Footprints, Speaker, PersonStanding, Tent, Swords, Spade, Puzzle, ScanEye, MicVocal, WandSparkles,
} from 'lucide-react';
import { MEDIA_TYPE_PLUGIN_DEFINITIONS, type MediaType } from './mediaLibrary';
import { FOUNDATION_TOOL_DEFINITIONS } from './foundationTools';
import { SELF_HOSTED_TOOL_DEFINITIONS } from './selfHostedTools';
import { WORKSPACE_TOOLS } from './workspaceTools/definitions';

export { MEDIA_TYPE_PLUGIN_IDS } from './mediaLibrary';
export {
  CITATION_MANAGER_PLUGIN_ID,
  DECISION_JOURNAL_PLUGIN_ID,
  SKILL_TREE_PLUGIN_ID,
  FLASHCARDS_PLUGIN_ID,
  FOUNDATION_PLUGIN_IDS,
  HIGHEST_VALUE_FOUNDATION_PLUGIN_IDS,
  KNOWLEDGE_LEARNING_PLUGIN_IDS,
  LEARNING_GOALS_PLUGIN_ID,
  LISTS_RANKINGS_PLUGIN_ID,
  MEDIA_DIARY_PLUGIN_ID,
  METADATA_RESOLVER_PLUGIN_ID,
  READING_ANNOTATIONS_PLUGIN_ID,
  READ_LATER_PLUGIN_ID,
  REMINDERS_PLUGIN_ID,
  UNIVERSAL_ATTACHMENTS_PLUGIN_ID,
} from './foundationTools';
export {
  CALDAV_SYNC_PLUGIN_ID,
  DOCUMENT_INBOX_PLUGIN_ID,
  FEEDS_READING_PLUGIN_ID,
  MANAGED_FILES_PLUGIN_ID,
  NOTIFICATION_GATEWAY_PLUGIN_ID,
  PDF_TOOLKIT_PLUGIN_ID,
  SELF_HOSTED_PLUGIN_IDS,
  WEB_ARCHIVE_PLUGIN_ID,
  WEB_WATCH_PLUGIN_ID,
} from './selfHostedTools';

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
/** Plugin id that unlocks month/year modes inside the unified Planner surface. */
export const CALENDAR_PLUGIN_ID = 'calendar-view';
/** Plugin id that adds the Timeline view (notes as a chronological stream). */
export const TIMELINE_PLUGIN_ID = 'timeline-view';
/** Plugin id that adds the Tag Explorer (nested tag tree that filters notes). */
export const TAGS_PLUGIN_ID = 'tag-explorer';
/** Plugin id that adds Saved Searches (named smart folders). */
export const SAVED_SEARCHES_PLUGIN_ID = 'saved-searches';
/** Local, read-only loader for an audit-core output directory. */
export const AUDIT_CORE_BROWSER_PLUGIN_ID = 'audit-core-browser';
/** Phase-ledger execution and artifact overview. */
export const AUDIT_CORE_OVERVIEW_PLUGIN_ID = 'audit-core-overview';
/** Scope, protocol fingerprint, and architecture graphs. */
export const AUDIT_CORE_SCOPE_PLUGIN_ID = 'audit-core-scope';
/** Threat model, hypotheses, review queues, and invariants. */
export const AUDIT_CORE_THREATS_PLUGIN_ID = 'audit-core-threats';
/** Cross-stage audit-core finding and evidence browser. */
export const AUDIT_CORE_FINDINGS_PLUGIN_ID = 'audit-core-findings';
/** Dynamic tests, traces, proofs, and validated exploits. */
export const AUDIT_CORE_TESTS_PLUGIN_ID = 'audit-core-tests';
/** Severity triage and final report renderer. */
export const AUDIT_CORE_REPORT_PLUGIN_ID = 'audit-core-report';
/** Fix-review and remediation artifact comparison. */
export const AUDIT_CORE_REMEDIATION_PLUGIN_ID = 'audit-core-remediation';
export const SECURITY_INVENTORY_PLUGIN_ID = 'security-inventory';
export const SECURITY_RESILIENCE_PLUGIN_ID = 'security-resilience';
export const SECURITY_INCIDENTS_PLUGIN_ID = 'security-incidents';
export const SECURITY_DASHBOARD_PLUGIN_ID = 'security-dashboard';
export const WEALTH_BALANCE_PLUGIN_ID = 'wealth-balance-sheet';
export const WEALTH_CASHFLOW_PLUGIN_ID = 'wealth-cashflow';
export const WEALTH_INVESTMENTS_PLUGIN_ID = 'wealth-investments-goals';
export const WEALTH_DASHBOARD_PLUGIN_ID = 'wealth-dashboard';
export const EVIDENCE_LIBRARY_PLUGIN_ID = 'evidence-library';
export const EVIDENCE_CLAIMS_PLUGIN_ID = 'evidence-claims';
export const EVIDENCE_REPRO_PLUGIN_ID = 'evidence-reproducibility';
export const EVIDENCE_DASHBOARD_PLUGIN_ID = 'evidence-dashboard';
export const CAREER_PORTFOLIO_PLUGIN_ID = 'career-portfolio';
export const CAREER_OPPORTUNITIES_PLUGIN_ID = 'career-opportunities';
export const CAREER_DEVELOPMENT_PLUGIN_ID = 'career-development';
export const CAREER_DASHBOARD_PLUGIN_ID = 'career-dashboard';
export const WRITING_MANUSCRIPTS_PLUGIN_ID = 'writing-manuscripts';
export const WRITING_EDITORIAL_PLUGIN_ID = 'writing-editorial';
export const WRITING_PUBLISHING_PLUGIN_ID = 'writing-publishing';
export const WRITING_DASHBOARD_PLUGIN_ID = 'writing-dashboard';
export const MOBILITY_VEHICLES_PLUGIN_ID = 'mobility-vehicles';
export const MOBILITY_OPERATIONS_PLUGIN_ID = 'mobility-operations';
export const MOBILITY_DOCUMENTS_PLUGIN_ID = 'mobility-documents';
export const MOBILITY_DASHBOARD_PLUGIN_ID = 'mobility-dashboard';
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
/** Metadata-only register backed by an outbound Paperless-ngx sync agent. */
export const PAPERLESS_PLUGIN_ID = 'paperless';
/** State-only queue consumed by the separately permissioned write-back identity. */
export const PAPERLESS_ACTIONS_PLUGIN_ID = 'paperless-actions';
/** Plugin id for Todo lists (tasks with due dates, priorities, note links). */
export const TODO_PLUGIN_ID = 'todo-lists';
/** Plugin id for dated Markdown notes with Notion-compatible day blocks. */
export const PLANNER_PLUGIN_ID = 'daily-notes';
/** Recurring routines and measurable habits projected into Planner day blocks. */
export const ROUTINES_PLUGIN_ID = 'routines-habits';
export const PERSONAL_SOPS_PLUGIN_ID = 'personal-sops';
/** Household chores, appliances, warranties, and service history. */
export const HOME_MAINTENANCE_PLUGIN_ID = 'home-maintenance';
/** Relationship records, follow-ups, interactions, birthdays, and gifts. */
export const PERSONAL_CRM_PLUGIN_ID = 'personal-crm';
/** Budgets, bills, subscriptions, renewals, and savings goals. */
export const FINANCE_SUBSCRIPTIONS_PLUGIN_ID = 'finance-subscriptions';
/** Trips, bookings, itineraries, packing, and travel documents. */
export const TRAVEL_PLANNER_PLUGIN_ID = 'travel-planner';
/** Appointments, medication, symptoms, measurements, and health notes. */
export const HEALTH_TRACKER_PLUGIN_ID = 'health-tracker';
/** Hobby projects, practice, skills, materials, and equipment. */
export const HOBBY_STUDIO_PLUGIN_ID = 'hobby-studio';
/** Portfolio of active, queued, and six-session hobby lanes. */
export const HOBBY_STACK_PLUGIN_ID = 'hobby-stack';
/** Day-block practice sessions and tangible hobby artifacts. */
export const HOBBY_PRACTICE_PLUGIN_ID = 'hobby-practice';
/** Energy- and company-aware restorative play menu. */
export const HOBBY_FUN_PLUGIN_ID = 'hobby-fun';
/** Portfolio balance, experiments, output, and social health. */
export const HOBBY_DASHBOARD_PLUGIN_ID = 'hobby-dashboard';
/** Music production projects and release pipeline. */
export const MUSIC_PROJECTS_PLUGIN_ID = 'music-track-lab';
/** Instrument, repertoire, theory, and rehearsal sessions. */
export const MUSIC_PRACTICE_PLUGIN_ID = 'music-practice';
/** Samples, patches, gear, references, repertoire, and setlists. */
export const MUSIC_LIBRARY_PLUGIN_ID = 'music-studio-library';
/** Production, practice, studio, and release overview. */
export const MUSIC_DASHBOARD_PLUGIN_ID = 'music-dashboard';
/** Electronics project lifecycle and revisions. */
export const ELECTRONICS_PROJECTS_PLUGIN_ID = 'electronics-projects';
/** Components, equipment, BOMs, stock, and procurement. */
export const ELECTRONICS_PARTS_PLUGIN_ID = 'electronics-parts';
/** Prototypes, PCBs, assembly, tests, firmware, enclosures, and repairs. */
export const ELECTRONICS_LAB_PLUGIN_ID = 'electronics-lab';
/** Build pipeline, blockers, stock, and test health. */
export const ELECTRONICS_DASHBOARD_PLUGIN_ID = 'electronics-dashboard';
export const HOMELAB_ASSETS_PLUGIN_ID = 'homelab-assets';
export const HOMELAB_OPERATIONS_PLUGIN_ID = 'homelab-operations';
export const HOMELAB_DASHBOARD_PLUGIN_ID = 'homelab-dashboard';
export const WARDROBE_CLOSET_PLUGIN_ID = 'wardrobe-closet';
export const STYLE_STUDIO_PLUGIN_ID = 'style-studio';
export const WARDROBE_DASHBOARD_PLUGIN_ID = 'wardrobe-dashboard';
export const TTRPG_CAMPAIGNS_PLUGIN_ID = 'ttrpg-campaigns';
export const TTRPG_WORLD_PLUGIN_ID = 'ttrpg-world';
export const TTRPG_SESSIONS_PLUGIN_ID = 'ttrpg-sessions';
export const TTRPG_DASHBOARD_PLUGIN_ID = 'ttrpg-dashboard';
/** Cross-system metrics and health without taking ownership of specialist data. */
export const LIFE_OS_DASHBOARD_PLUGIN_ID = 'life-os-dashboard';
/** Universal local index, search, timeline, and artifact gallery. */
export const LIFE_OS_EXPLORER_PLUGIN_ID = 'life-os-explorer';
/** Stable manual relationships between records owned by different plugins. */
export const LIFE_OS_RELATIONS_PLUGIN_ID = 'life-os-relations';
/** Whole-system weekly review snapshots. */
export const LIFE_OS_REVIEW_PLUGIN_ID = 'life-os-review';
/** Data-health checks plus provider-neutral backup, export, and restore. */
export const LIFE_OS_PORTABILITY_PLUGIN_ID = 'life-os-portability';
/** Companies, contacts, engagements, pipeline state, and next actions. */
export const BUSINESS_DIRECTORY_PLUGIN_ID = 'business-directory';
/** Proposals, quotes, contracts, signatures, value, and expiry. */
export const BUSINESS_CONTRACTS_PLUGIN_ID = 'business-contracts';
/** Evidence matching across expenses, invoices, and bank records. */
export const BUSINESS_RECONCILIATION_PLUGIN_ID = 'business-reconciliation';
/** Administrative filings, renewals, authorities, and due dates. */
export const BUSINESS_OBLIGATIONS_PLUGIN_ID = 'business-obligations';
/** Vendors, notice periods, correspondence, and response deadlines. */
export const BUSINESS_OPERATIONS_PLUGIN_ID = 'business-operations';
/** Cross-business administrative and commercial health. */
export const BUSINESS_DASHBOARD_PLUGIN_ID = 'business-dashboard';
/** Product wishlists, comparisons, orders, returns, and warranties. */
export const WISHLIST_PURCHASES_PLUGIN_ID = 'wishlist-purchases';
/** Saved places, planned visits, visit logs, and ratings. */
export const PLACES_LIBRARY_PLUGIN_ID = 'places-library';
/** Mood, energy, gratitude, highlights, and reflections. */
export const JOURNAL_REFLECTION_PLUGIN_ID = 'journal-reflection';
/** Possessions, storage, serials, receipts, lending, and insured values. */
export const HOME_INVENTORY_PLUGIN_ID = 'home-inventory';
/** Connected meal planning, recipes, shopping, pantry inventory, and batch prep. */
export const MEAL_PLANNER_PLUGIN_ID = 'meal-planner';
/** Weekly workout and exercise planning in an independent specialist store. */
export const WORKOUT_PLANNER_PLUGIN_ID = 'workout-planner';
/** Cross-format catalog for written, watched, listened, played, learned, and live media. */
export const MEDIA_LIBRARY_PLUGIN_ID = 'media-library';
/** Education programs and courses with optional PARA links. */
export const EDUCATION_CORE_PLUGIN_ID = 'education-core';
/** Hierarchical course curriculum. */
export const EDUCATION_CURRICULUM_PLUGIN_ID = 'education-curriculum';
/** Day-block-aware study sessions. */
export const EDUCATION_STUDY_PLUGIN_ID = 'education-study';
/** Assignments, assessments, submissions, and grades. */
export const EDUCATION_ASSIGNMENTS_PLUGIN_ID = 'education-assignments';
/** Read-only education workload and progress dashboard. */
export const EDUCATION_DASHBOARD_PLUGIN_ID = 'education-dashboard';
/** Capture and route information through the ten intent-based intake modes. */
export const INFORMATION_INTAKE_PLUGIN_ID = 'information-intake';
/** Execute routed information using mode-specific questions and stopping rules. */
export const INFORMATION_WORKBENCH_PLUGIN_ID = 'information-workbench';
/** Durable outputs created by research, decisions, solutions, creation, and practice. */
export const INFORMATION_OUTPUTS_PLUGIN_ID = 'information-outputs';
/** Cadence, WIP limits, transitions, and system-health overview for information intake. */
export const INFORMATION_DASHBOARD_PLUGIN_ID = 'information-dashboard';
/** Full ten-stage research workflow with shared projects, provenance, gates, and maintenance. */
export const RESEARCH_WORKFLOW_ENGINE_PLUGIN_ID = 'research-workflow-engine';
/** Plugin id for German tax automation blueprint nodes. */
export const TAX_AUTOMATION_PLUGIN_ID = 'tax-automation';
/** Plugin id for the Noesis daily knowledge brief blueprint node. */
export const NOESIS_BRIEF_PLUGIN_ID = 'noesis-brief';
/** Modified PARA canonical entities: Projects, Areas, Resources, Archive. */
export const PARA_CORE_PLUGIN_ID = 'para-core';
/** Universal capture inbox and PARA routing. */
export const PARA_CAPTURE_PLUGIN_ID = 'para-capture';
/** PARA-aware tasks and next actions. */
export const PARA_TASKS_PLUGIN_ID = 'para-tasks';
/** Quarterly direction spanning several PARA subareas. */
export const PARA_GOALS_PLUGIN_ID = 'para-goals';
/** Daily/weekly system maintenance and review history. */
export const PARA_REVIEW_PLUGIN_ID = 'para-review';
/** Read-only command-center projections over PARA and enabled Life stores. */
export const PARA_DASHBOARD_PLUGIN_ID = 'para-dashboard';
/** Dry-run importer for Notion CSV/Markdown exports. */
export const PARA_MIGRATION_PLUGIN_ID = 'para-notion-migration';
/** Advanced note rendering, analysis, export, sync, and provenance tools. */
export const LATEX_PLUGIN_ID = 'latex';
export const AI_SUMMARY_PLUGIN_ID = 'ai-summary';
export const GITHUB_SYNC_PLUGIN_ID = 'github-sync';
export const MERMAID_PLUGIN_ID = 'mermaid';
export const PDF_EXPORT_PLUGIN_ID = 'pdf-export';
export const GRAPH_STATS_PLUGIN_ID = 'graph-stats';
export const WEB3_ID_PLUGIN_ID = 'web3-id';
export const FOCUS_PLUGIN_ID = 'focus';
export const IPFS_ATTACH_PLUGIN_ID = 'ipfs-attach';
export const TIMESTAMP_PROOFS_PLUGIN_ID = 'timestamp-proofs';
export const SEMANTIC_SEARCH_PLUGIN_ID = 'semantic-search';
export const AUTO_LINKER_PLUGIN_ID = 'auto-linker';

const MEDIA_PLUGIN_ICONS: Record<MediaType, LucideIcon> = {
  Book: BookOpen,
  Ebook: BookText,
  Audiobook: Headphones,
  'Short story': FilePenLine,
  Novella: NotebookPen,
  Essay: ScrollText,
  Article: Newspaper,
  'Comic & graphic novel': PanelsTopLeft,
  Manga: BookCopy,
  'Magazine & zine': Newspaper,
  Poetry: Feather,
  Movie: Clapperboard,
  'TV series': Tv,
  'YouTube video': Youtube,
  Animation: WandSparkles,
  Album: Disc3,
  Song: Music2,
  Podcast,
  'Video game': Gamepad2,
  'Board game': Dice20,
  TTRPG: Swords,
  'Card game': Spade,
  Puzzle: Puzzle,
  ARG: ScanEye,
  Course: GraduationCap,
  'Live performance': Theater,
  'Stand-up': MicVocal,
  Photograph: Camera,
  Artwork: Palette,
  'Graphic design': PenTool,
  Architecture: Building2,
  'Product design': Armchair,
  Illustration: Paintbrush,
  Documentary: Video,
  'Short film': Film,
  'Music video': MonitorPlay,
  'Experimental film': Aperture,
  'Web series': Globe,
  'Commercial & title sequence': Projector,
  'Radio drama': Radio,
  'Radio documentary': RadioTower,
  'DJ mix': Disc,
  'Live recording': AudioLines,
  Interview: MessageSquareQuote,
  'Speech & lecture': Presentation,
  Debate: MessagesSquare,
  'Oral history': History,
  Reading: BookAudio,
  Theatre: Drama,
  Musical: Music4,
  Opera: Landmark,
  Dance: Footprints,
  Concert: Speaker,
  'Performance art': PersonStanding,
  'Circus & physical theatre': Tent,
  'Magic & illusion': Sparkles,
};

export const PLUGINS: PluginInfo[] = [
  ...AWARENESS_PLUGINS.map(plugin => ({ ...plugin, category: 'research', subcategory: 'Awareness', downloads: '0', rating: 'New' })),
  ...RESEARCH_ROLES.map(role => ({ id: role.id, name: role.name, desc: role.desc, category: 'research', subcategory: role.stage, downloads: '0', rating: 'New', icon: role.icon })),
  ...WORKSPACE_TOOLS.map(tool => ({ ...tool, category: 'productivity', subcategory: 'Workspace', downloads: '0', rating: 'New' })),
  { id: NOTES_PLUGIN_ID, name: 'Markdown Notes', desc: 'Markdown editor with wiki-style [[links]], tags and on-chain anchoring.', category: 'productivity', subcategory: 'Writing', downloads: '24.1k', rating: '4.9', icon: FileText },
  { id: OUTLINE_PLUGIN_ID, name: 'Obsidian Outline', desc: 'Obsidian-style document outline plus in-note heading links: jump between a note’s headings.', category: 'productivity', subcategory: 'Writing', downloads: '13.2k', rating: '4.8', icon: ListTree },
  { id: DATABASE_PLUGIN_ID, name: 'Embedded Databases', desc: 'Notion-style databases inside a note: typed columns, a table and a board view, edited inline.', category: 'productivity', subcategory: 'Organizing', downloads: '16.7k', rating: '4.8', icon: Table2 },
  { id: GRAPH_PLUGIN_ID, name: 'Knowledge Graph', desc: 'Interactive force-directed graph of your notes and their links.', category: 'analytics', subcategory: 'Visualization', downloads: '18.6k', rating: '4.9', icon: Waypoints },
  { id: CANVAS_PLUGIN_ID, name: 'Canvas', desc: 'Freeform board: arrange note cards spatially and draw connections between them.', category: 'productivity', subcategory: 'Whiteboard', downloads: '7.3k', rating: '4.7', icon: Frame },
  { id: CALENDAR_PLUGIN_ID, name: 'Calendar', desc: 'Adds Month and Year to Planner’s unified Day / Week / Month / Year surface, with day-planner popovers.', category: 'productivity', subcategory: 'Planning', downloads: '9.4k', rating: '4.7', icon: CalendarDays },
  { id: TIMELINE_PLUGIN_ID, name: 'Timeline', desc: 'Notes as a chronological stream grouped by day, week, or month.', category: 'analytics', subcategory: 'Visualization', downloads: '6.8k', rating: '4.6', icon: History },
  { id: TAGS_PLUGIN_ID, name: 'Tag Explorer', desc: 'Browse nested tags as a tree with counts and filter notes by tag.', category: 'productivity', subcategory: 'Organizing', downloads: '8.1k', rating: '4.7', icon: Tags },
  { id: SAVED_SEARCHES_PLUGIN_ID, name: 'Saved Searches', desc: 'Save a query as a named smart folder that always reflects your notes.', category: 'productivity', subcategory: 'Search', downloads: '5.9k', rating: '4.6', icon: FolderSearch },
  { id: AUDIT_CORE_BROWSER_PLUGIN_ID, name: 'Audit Core Browser', desc: 'Open an audit-core output folder locally and expose its immutable JSON artifacts to the viewer pack.', category: 'audit', subcategory: 'Audit Core', downloads: '0', rating: 'New', icon: FolderOpen },
  { id: AUDIT_CORE_OVERVIEW_PLUGIN_ID, name: 'Audit Core Phase Dashboard', desc: 'Read phase-ledger execution status, artifact coverage, properties, waivers, and compatibility signals.', category: 'audit', subcategory: 'Audit Core', downloads: '0', rating: 'New', icon: Gauge },
  { id: AUDIT_CORE_SCOPE_PLUGIN_ID, name: 'Audit Core Scope & Architecture', desc: 'Inspect scope, fingerprints, call graphs, inheritance, data flow, roles, and upgrade surfaces.', category: 'audit', subcategory: 'Audit Core', downloads: '0', rating: 'New', icon: Network },
  { id: AUDIT_CORE_THREATS_PLUGIN_ID, name: 'Audit Core Threat Model', desc: 'Inspect attack trees, trust boundaries, hypotheses, risk clusters, review queues, and invariants.', category: 'audit', subcategory: 'Audit Core', downloads: '0', rating: 'New', icon: ShieldAlert },
  { id: AUDIT_CORE_FINDINGS_PLUGIN_ID, name: 'Audit Core Findings & Evidence', desc: 'Filter findings across automated, manual, validated, triaged, and report stages with raw evidence.', category: 'audit', subcategory: 'Audit Core', downloads: '0', rating: 'New', icon: ListChecks },
  { id: AUDIT_CORE_TESTS_PLUGIN_ID, name: 'Audit Core Tests & Exploits', desc: 'Explore dynamic test runs, tools, counterexamples, proofs, traces, and validated exploit sequences.', category: 'audit', subcategory: 'Audit Core', downloads: '0', rating: 'New', icon: FlaskConical },
  { id: AUDIT_CORE_REPORT_PLUGIN_ID, name: 'Audit Core Severity & Report', desc: 'Render final severities, executive summary, coverage limitations, traceability, and report findings.', category: 'audit', subcategory: 'Audit Core', downloads: '0', rating: 'New', icon: FileCheck2 },
  { id: AUDIT_CORE_REMEDIATION_PLUGIN_ID, name: 'Audit Core Remediation', desc: 'Compare fix-review, resolution, regression, and remediation artifacts produced by audit-core.', category: 'audit', subcategory: 'Audit Core', downloads: '0', rating: 'New', icon: GitCompareArrows },
  { id: SECURITY_INVENTORY_PLUGIN_ID, name: 'Security Inventory', desc: 'Account, device, public-wallet, and identity posture metadata without credentials or recovery secrets.', category: 'security', subcategory: 'Inventory', downloads: '0', rating: 'New', icon: ShieldAlert },
  { id: SECURITY_RESILIENCE_PLUGIN_ID, name: 'Keys, Backups & Recovery', desc: 'Rotation reminders, backup verification, recovery exercises, and emergency-access checks.', category: 'security', subcategory: 'Resilience', downloads: '0', rating: 'New', icon: RefreshCw },
  { id: SECURITY_INCIDENTS_PLUGIN_ID, name: 'Incidents & Procedures', desc: 'Security incidents, response procedures, exercises, trusted contacts, and follow-up actions.', category: 'security', subcategory: 'Response', downloads: '0', rating: 'New', icon: ShieldAlert },
  { id: SECURITY_DASHBOARD_PLUGIN_ID, name: 'Security Command Center', desc: 'Review due dates, failed checks, at-risk assets, recovery readiness, and incident status.', category: 'security', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: WEALTH_BALANCE_PLUGIN_ID, name: 'Accounts, Assets & Liabilities', desc: 'Provider-neutral accounts, assets, liabilities, valuations, and ownership metadata.', category: 'wealth', subcategory: 'Balance Sheet', downloads: '0', rating: 'New', icon: Landmark },
  { id: WEALTH_CASHFLOW_PLUGIN_ID, name: 'Cash Flow & Savings', desc: 'Recurring income, expenses, transfers, budgets, and savings contributions.', category: 'wealth', subcategory: 'Cash Flow', downloads: '0', rating: 'New', icon: PiggyBank },
  { id: WEALTH_INVESTMENTS_PLUGIN_ID, name: 'Investments & Goals', desc: 'Holdings, portfolios, savings goals, retirement targets, allocation notes, and snapshots.', category: 'wealth', subcategory: 'Investing', downloads: '0', rating: 'New', icon: ChartNetwork },
  { id: WEALTH_DASHBOARD_PLUGIN_ID, name: 'Wealth Dashboard', desc: 'Tracked net value, cash-flow obligations, investment reviews, and savings-goal status.', category: 'wealth', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: EVIDENCE_LIBRARY_PLUGIN_ID, name: 'Sources & Bibliography', desc: 'Papers, books, web sources, datasets, quotations, citation data, and stable locators.', category: 'evidence', subcategory: 'Sources', downloads: '0', rating: 'New', icon: LibraryBig },
  { id: EVIDENCE_CLAIMS_PLUGIN_ID, name: 'Claims & Evidence Map', desc: 'Claims, supporting and opposing evidence, confidence, dependencies, and synthesis.', category: 'evidence', subcategory: 'Reasoning', downloads: '0', rating: 'New', icon: ChartNetwork },
  { id: EVIDENCE_REPRO_PLUGIN_ID, name: 'Reproducibility Records', desc: 'Procedures, environments, datasets, runs, commits, outputs, and replication results.', category: 'evidence', subcategory: 'Reproducibility', downloads: '0', rating: 'New', icon: FlaskConical },
  { id: EVIDENCE_DASHBOARD_PLUGIN_ID, name: 'Evidence Lab Dashboard', desc: 'Source extraction, claim support, contested evidence, citations, and reproducibility status.', category: 'evidence', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: CAREER_PORTFOLIO_PLUGIN_ID, name: 'Career Portfolio', desc: 'Roles, CV variants, accomplishments, portfolio evidence, and measurable impact statements.', category: 'career', subcategory: 'Portfolio', downloads: '0', rating: 'New', icon: BriefcaseBusiness },
  { id: CAREER_OPPORTUNITIES_PLUGIN_ID, name: 'Applications & Interviews', desc: 'Target roles, applications, interview stages, offers, contacts, and follow-ups.', category: 'career', subcategory: 'Opportunities', downloads: '0', rating: 'New', icon: ContactRound },
  { id: CAREER_DEVELOPMENT_PLUGIN_ID, name: 'Professional Development', desc: 'Skills, certifications, learning goals, mentorship, and career experiments.', category: 'career', subcategory: 'Development', downloads: '0', rating: 'New', icon: GraduationCap },
  { id: CAREER_DASHBOARD_PLUGIN_ID, name: 'Career Dashboard', desc: 'Active opportunities, interview dates, portfolio readiness, and development progress.', category: 'career', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: WRITING_MANUSCRIPTS_PLUGIN_ID, name: 'Manuscripts', desc: 'Books, essays, articles, stories, scripts, and other long-lived writing projects.', category: 'writing', subcategory: 'Writing', downloads: '0', rating: 'New', icon: NotebookPen },
  { id: WRITING_EDITORIAL_PLUGIN_ID, name: 'Editorial Workflow', desc: 'Draft versions, structural edits, copy edits, feedback rounds, and approval gates.', category: 'writing', subcategory: 'Editorial', downloads: '0', rating: 'New', icon: ListChecks },
  { id: WRITING_PUBLISHING_PLUGIN_ID, name: 'Submissions & Publishing', desc: 'Pitches, submissions, publications, rights, releases, and post-publication records.', category: 'writing', subcategory: 'Publishing', downloads: '0', rating: 'New', icon: ScrollText },
  { id: WRITING_DASHBOARD_PLUGIN_ID, name: 'Writing Dashboard', desc: 'Manuscript momentum, tracked words, editorial queues, submissions, and publication status.', category: 'writing', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: MOBILITY_VEHICLES_PLUGIN_ID, name: 'Vehicles', desc: 'Cars, bicycles, motorcycles, shared vehicles, specifications, ownership, and condition.', category: 'mobility', subcategory: 'Fleet', downloads: '0', rating: 'New', icon: Palmtree },
  { id: MOBILITY_OPERATIONS_PLUGIN_ID, name: 'Mileage & Maintenance', desc: 'Mileage, inspections, service, repairs, fuel, charging, and recurring maintenance.', category: 'mobility', subcategory: 'Operations', downloads: '0', rating: 'New', icon: Wrench },
  { id: MOBILITY_DOCUMENTS_PLUGIN_ID, name: 'Permits & Transport Passes', desc: 'Licenses, registration, insurance, permits, toll products, and public-transport passes.', category: 'mobility', subcategory: 'Documents', downloads: '0', rating: 'New', icon: WalletCards },
  { id: MOBILITY_DASHBOARD_PLUGIN_ID, name: 'Travel & Mobility Dashboard', desc: 'Trips, vehicles, service dates, mileage, expiring permits, and transport-pass status.', category: 'mobility', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: CHECKLISTS_PLUGIN_ID, name: 'Audit Checklists', desc: 'Methodology checklists per contract type (ERC-20, ERC-721, proxy, DeFi) with per-section progress in the note panel.', category: 'audit', subcategory: 'Methodology', downloads: '1.4k', rating: '4.8', icon: ListChecks },
  { id: RECHNUNG_PLUGIN_ID, name: 'Rechnung (German Invoicing)', desc: 'Invoices as ```invoice fences: §14 UStG field checks, VAT modes incl. reverse charge and §19, sequential numbering, ZUGFeRD (EN 16931) export.', category: 'business', subcategory: 'Invoicing', downloads: '2.3k', rating: '4.9', icon: ReceiptText },
  { id: REPORTS_PLUGIN_ID, name: 'Audit Reports', desc: 'Compile an engagement’s scope and findings into a report note; export to PDF or markdown and anchor the report on-chain.', category: 'audit', subcategory: 'Reports', downloads: '1.6k', rating: '4.9', icon: ScrollText },
  { id: VULN_KB_PLUGIN_ID, name: 'Vulnerability Knowledge Base', desc: 'Clusters classified findings (class: vuln/…) across engagements, links each class to its writeup note, and surfaces related findings on every note.', category: 'audit', subcategory: 'Knowledge', downloads: '1.1k', rating: '4.8', icon: BookOpen },
  { id: FINDINGS_PLUGIN_ID, name: 'Findings Tracker', desc: 'Structured audit findings inside notes (```finding fences) plus a cross-engagement dashboard with severity and status filters.', category: 'audit', subcategory: 'Findings', downloads: '1.9k', rating: '4.9', icon: Bug },
  { id: LATEX_PLUGIN_ID, name: 'LaTeX Math', desc: 'Render mathematical equations inline and in blocks using KaTeX.', category: 'render', subcategory: 'Math', downloads: '12.4k', rating: '4.8', icon: Sigma },
  { id: AI_SUMMARY_PLUGIN_ID, name: 'AI Summarizer', desc: 'Generate concise summaries and key points through Modulo’s configured AI service.', category: 'ai', subcategory: 'Writing', downloads: '8.9k', rating: '4.6', icon: Sparkles },
  { id: GITHUB_SYNC_PLUGIN_ID, name: 'GitHub Sync', desc: 'Back up your notes as Markdown to a GitHub repository on demand.', category: 'sync', downloads: '15.2k', rating: '4.9', icon: Github },
  { id: MERMAID_PLUGIN_ID, name: 'Mermaid Diagrams', desc: 'Create flowcharts and sequence diagrams using Mermaid syntax.', category: 'render', subcategory: 'Diagrams', downloads: '6.7k', rating: '4.5', icon: Workflow },
  { id: PDF_EXPORT_PLUGIN_ID, name: 'PDF Export', desc: 'Export individual notes or the complete vault as printable documents.', category: 'export', downloads: '9.1k', rating: '4.3', icon: FileDown },
  { id: GRAPH_STATS_PLUGIN_ID, name: 'Graph Analytics', desc: 'Degree, PageRank, density, components, hubs, and orphan analysis for the knowledge graph.', category: 'analytics', subcategory: 'Metrics', downloads: '3.2k', rating: '4.7', icon: ChartNetwork },
  { id: WEB3_ID_PLUGIN_ID, name: 'Web3 Identity', desc: 'Create wallet-signed identity statements for verifiable authorship.', category: 'web3', subcategory: 'Identity', downloads: '4.5k', rating: '4.4', icon: Fingerprint },
  { id: TAX_AUTOMATION_PLUGIN_ID, name: 'Tax Automation', desc: 'Blueprint nodes for the German tax rhythm: USt-VA/ZM deadline reminders, overdue-invoice chase drafts, VIES USt-IdNr checks.', category: 'business', subcategory: 'Automation', downloads: '0.9k', rating: '4.6', icon: CalendarClock },
  { id: GOBD_PLUGIN_ID, name: 'GoBD Vault', desc: 'Retention tracking for notes tagged retain/<class> with configurable periods, anchored-integrity status, and a Verfahrensdokumentation template.', category: 'business', subcategory: 'Compliance', downloads: '1.2k', rating: '4.6', icon: Archive },
  { id: PAPERLESS_PLUGIN_ID, name: 'Paperless-ngx Records', desc: 'Search a privacy-filtered document metadata register, track retention and expiry, link PARA work, and monitor your home sync agent.', category: 'productivity', subcategory: 'Organizing', downloads: '0', rating: 'New', icon: LibraryBig },
  { id: EUER_PLUGIN_ID, name: 'Books (EÜR + DATEV)', desc: 'Income from paid invoices, expenses by category, USt-VA period numbers, and DATEV Buchungsstapel CSV export for your Steuerberater.', category: 'business', subcategory: 'Bookkeeping', downloads: '1.8k', rating: '4.7', icon: BookText },
  { id: ZEITERFASSUNG_PLUGIN_ID, name: 'Zeiterfassung (Time Tracking)', desc: 'Timer and manual entries per engagement; unbilled billable time converts into ```invoice line items.', category: 'business', subcategory: 'Time', downloads: '2.1k', rating: '4.7', icon: Timer },
  { id: FOCUS_PLUGIN_ID, name: 'Focus Timer', desc: 'Built-in Pomodoro timer that logs focus sessions linked to your notes.', category: 'productivity', subcategory: 'Focus', downloads: '7.8k', rating: '4.2', icon: Timer },
  { id: IPFS_ATTACH_PLUGIN_ID, name: 'IPFS Attachments', desc: 'Pin note content to IPFS and retain its content-addressed CID.', category: 'web3', subcategory: 'Storage', downloads: '5.6k', rating: '4.5', icon: Paperclip },
  { id: TIMESTAMP_PROOFS_PLUGIN_ID, name: 'Timestamp Proofs', desc: 'Create portable SHA-256 timestamp manifests with chain or IPFS anchor references when available.', category: 'web3', subcategory: 'Proofs', downloads: '2.4k', rating: '4.3', icon: Stamp },
  { id: 'webhook-trigger', name: 'Webhook Trigger', desc: 'Start a blueprint workflow from an inbound webhook.', category: 'automation', subcategory: 'Triggers', downloads: '6.1k', rating: '4.6', icon: Webhook },
  { id: NOESIS_BRIEF_PLUGIN_ID, name: 'Noesis Daily Brief', desc: 'Blueprint node that pulls the daily knowledge brief — news, economics, tech, web3, and new research publications, every line cited — from a Noesis instance; pair with On Schedule and Create Note to file it as a linked note.', category: 'automation', subcategory: 'Knowledge', downloads: '0.1k', rating: '4.8', icon: Newspaper },
  { id: 'scheduled-digest', name: 'Scheduled Digest', desc: 'Email or post a daily or weekly summary of note changes.', category: 'automation', subcategory: 'Scheduled', downloads: '4.9k', rating: '4.4', icon: CalendarClock },
  { id: SEMANTIC_SEARCH_PLUGIN_ID, name: 'Semantic Search', desc: 'Private local vector search across the entire vault using weighted terms and phrases.', category: 'ai', subcategory: 'Search', downloads: '11.3k', rating: '4.7', icon: ScanSearch },
  { id: AUTO_LINKER_PLUGIN_ID, name: 'Auto-Linker', desc: 'Suggest and create links between notes from local content similarity.', category: 'ai', subcategory: 'Writing', downloads: '8.2k', rating: '4.5', icon: Link2 },
  { id: TODO_PLUGIN_ID, name: 'Todo Lists', desc: 'Tasks with due dates, priorities and lists, linkable to notes; filter by today, this week, or overdue.', category: 'productivity', subcategory: 'Tasks', downloads: '3.4k', rating: '4.7', icon: ListTodo },
  { id: PLANNER_PLUGIN_ID, name: 'Planner (Daily Notes)', desc: 'Dated Markdown notes with eight Notion-compatible day blocks, PARA task scheduling, carry-over, and a week overview.', category: 'productivity', subcategory: 'Journaling', downloads: '10.4k', rating: '4.8', icon: CalendarDays },
  { id: PERSONAL_SOPS_PLUGIN_ID, name: 'Personal SOPs', desc: 'Reusable procedures with independent checklist runs, linked notes, and run history.', category: 'productivity', subcategory: 'Planning', downloads: '0', rating: 'New', icon: ClipboardCheck },
  { id: ROUTINES_PLUGIN_ID, name: 'Routines & Habits', desc: 'Recurring routines and measurable habits integrated into Planner blocks, with flexible schedules, daily targets, and streaks.', category: 'life', subcategory: 'Planning', downloads: '0', rating: 'New', icon: Repeat2 },
  { id: HOME_MAINTENANCE_PLUGIN_ID, name: 'Home & Maintenance', desc: 'Recurring chores, rooms, appliances, repairs, warranties, manuals, checklists, and service history.', category: 'life', subcategory: 'Home', downloads: '0', rating: 'New', icon: Home },
  { id: PERSONAL_CRM_PLUGIN_ID, name: 'Personal CRM', desc: 'People, relationships, birthdays, follow-ups, interaction history, contact details, and gift ideas.', category: 'life', subcategory: 'Relationships', downloads: '0', rating: 'New', icon: ContactRound },
  { id: FINANCE_SUBSCRIPTIONS_PLUGIN_ID, name: 'Finance & Subscriptions', desc: 'Budgets, recurring bills, subscriptions, renewals, payment history, and savings goals.', category: 'life', subcategory: 'Finance', downloads: '0', rating: 'New', icon: PiggyBank },
  { id: TRAVEL_PLANNER_PLUGIN_ID, name: 'Travel Planner', desc: 'Trips, bookings, reservations, itineraries, packing checklists, destinations, and documents.', category: 'life', subcategory: 'Travel', downloads: '0', rating: 'New', icon: Palmtree },
  { id: HEALTH_TRACKER_PLUGIN_ID, name: 'Health Tracker', desc: 'Appointments, medications, symptoms, measurements, care checklists, and private health logs.', category: 'life', subcategory: 'Health', downloads: '0', rating: 'New', icon: HeartPulse },
  { id: HOBBY_STUDIO_PLUGIN_ID, name: 'Hobby Studio', desc: 'Hobby projects, practice sessions, skill levels, materials, equipment, milestones, and practice logs.', category: 'life', subcategory: 'Hobbies', downloads: '0', rating: 'New', icon: Sparkles },
  { id: HOBBY_STACK_PLUGIN_ID, name: 'Hobby Stack', desc: 'A full-stack portfolio of active and queued hobby lanes with six-session trials, anchors, setup, energy, and next actions.', category: 'hobbies', subcategory: 'Portfolio', downloads: '0', rating: 'New', icon: Layers3 },
  { id: HOBBY_PRACTICE_PLUGIN_ID, name: 'Hobby Practice & Artifacts', desc: 'Plan practice in day blocks, complete six-session experiments, and capture tangible outputs.', category: 'hobbies', subcategory: 'Practice', downloads: '0', rating: 'New', icon: Hammer },
  { id: HOBBY_FUN_PLUGIN_ID, name: 'Fun Menu', desc: 'Choose restorative play by energy and social mode, with screen balance and weekly fun-block tracking.', category: 'hobbies', subcategory: 'Recovery', downloads: '0', rating: 'New', icon: PartyPopper },
  { id: HOBBY_DASHBOARD_PLUGIN_ID, name: 'Hobby Command Center', desc: 'Anchor coverage, session experiments, artifacts, restorative balance, and people-you-can-text metrics.', category: 'hobbies', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: MUSIC_PROJECTS_PLUGIN_ID, name: 'Track Lab', desc: 'Tracks, EPs, albums, live sets, modular patches, production stages, versions, collaborators, and release readiness.', category: 'music', subcategory: 'Production', downloads: '0', rating: 'New', icon: Disc3 },
  { id: MUSIC_PRACTICE_PLUGIN_ID, name: 'Instrument Practice', desc: 'Guitar, piano, repertoire, theory, ear training, rehearsals, tempo, and day-block sessions.', category: 'music', subcategory: 'Practice', downloads: '0', rating: 'New', icon: Guitar },
  { id: MUSIC_LIBRARY_PLUGIN_ID, name: 'Music Library & Studio', desc: 'Samples, presets, patches, gear, references, repertoire, setlists, signal chains, sources, and licenses.', category: 'music', subcategory: 'Assets', downloads: '0', rating: 'New', icon: LibraryBig },
  { id: MUSIC_DASHBOARD_PLUGIN_ID, name: 'Music Dashboard', desc: 'Production momentum, practice time, missing next actions, releases, gear, and modular patch health.', category: 'music', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: ELECTRONICS_PROJECTS_PLUGIN_ID, name: 'Electronics Projects', desc: 'Specification-to-artifact build pipeline with revisions, repositories, next actions, and finish criteria.', category: 'electronics', subcategory: 'Projects', downloads: '0', rating: 'New', icon: CircuitBoard },
  { id: ELECTRONICS_PARTS_PLUGIN_ID, name: 'Components & Procurement', desc: 'Component library, footprints, datasheets, storage, stock thresholds, BOMs, vendors, orders, and substitutions.', category: 'electronics', subcategory: 'Parts', downloads: '0', rating: 'New', icon: Cpu },
  { id: ELECTRONICS_LAB_PLUGIN_ID, name: 'Prototype, Build & Test Lab', desc: 'Circuit notes, prototypes, PCBs, assembly, measurements, firmware, enclosures, repairs, and knowledge.', category: 'electronics', subcategory: 'Lab', downloads: '0', rating: 'New', icon: FlaskConical },
  { id: ELECTRONICS_DASHBOARD_PLUGIN_ID, name: 'Workbench Dashboard', desc: 'Active builds, procurement blockers, low stock, failed tests, pipeline position, and finished artifacts.', category: 'electronics', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: HOMELAB_ASSETS_PLUGIN_ID, name: 'Homelab Infrastructure', desc: 'Devices, networks, VLANs, VMs, containers, services, domains, topology, and criticality.', category: 'homelab', subcategory: 'Infrastructure', downloads: '0', rating: 'New', icon: Server },
  { id: HOMELAB_OPERATIONS_PLUGIN_ID, name: 'Homelab Operations', desc: 'Deployments, changes, incidents, maintenance, backups, restore tests, and experiments.', category: 'homelab', subcategory: 'Operations', downloads: '0', rating: 'New', icon: Wrench },
  { id: HOMELAB_DASHBOARD_PLUGIN_ID, name: 'Homelab Dashboard', desc: 'Service health, degraded assets, failed operations, backup coverage, and restore confidence.', category: 'homelab', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: WARDROBE_CLOSET_PLUGIN_ID, name: 'Wardrobe', desc: 'Garments, fit, seasons, storage, repairs, alterations, inventory, and wishlist references.', category: 'style', subcategory: 'Closet', downloads: '0', rating: 'New', icon: Shirt },
  { id: STYLE_STUDIO_PLUGIN_ID, name: 'Style Studio', desc: 'Outfits, capsules, silhouettes, archetypes, occasions, experiments, wears, and seasonal reviews.', category: 'style', subcategory: 'Studio', downloads: '0', rating: 'New', icon: Sparkles },
  { id: WARDROBE_DASHBOARD_PLUGIN_ID, name: 'Style Dashboard', desc: 'Capsule coverage, garment care, outfit reuse, experiments, and wardrobe gaps.', category: 'style', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: TTRPG_CAMPAIGNS_PLUGIN_ID, name: 'TTRPG Campaigns', desc: 'Systems, groups, cadence, scheduling, tone, locations, and safety agreements.', category: 'ttrpg', subcategory: 'Campaigns', downloads: '0', rating: 'New', icon: Dice20 },
  { id: TTRPG_WORLD_PLUGIN_ID, name: 'World & Characters', desc: 'Characters, NPCs, locations, factions, quests, items, lore, encounters, and handouts.', category: 'ttrpg', subcategory: 'World', downloads: '0', rating: 'New', icon: BookOpen },
  { id: TTRPG_SESSIONS_PLUGIN_ID, name: 'TTRPG Sessions', desc: 'Session prep, scheduling, attendance, recaps, decisions, consequences, and next hooks.', category: 'ttrpg', subcategory: 'Sessions', downloads: '0', rating: 'New', icon: ScrollText },
  { id: TTRPG_DASHBOARD_PLUGIN_ID, name: 'Campaign Dashboard', desc: 'Active tables, upcoming sessions, prep load, continuity, world depth, and recurring community.', category: 'ttrpg', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: LIFE_OS_DASHBOARD_PLUGIN_ID, name: 'Life OS Dashboard', desc: 'Cross-system metrics, connected-source coverage, recent activity, relationship counts, and integration health.', category: 'life-os', subcategory: 'Overview', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: LIFE_OS_EXPLORER_PLUGIN_ID, name: 'Universal Explorer', desc: 'Search and browse records, activity, and artifacts across local specialist plugins without merging their stores.', category: 'life-os', subcategory: 'Discovery', downloads: '0', rating: 'New', icon: ScanSearch },
  { id: LIFE_OS_RELATIONS_PLUGIN_ID, name: 'Cross-Plugin Relations', desc: 'Stable labeled relationships between records owned by different specialist systems.', category: 'life-os', subcategory: 'Integration', downloads: '0', rating: 'New', icon: Link2 },
  { id: LIFE_OS_REVIEW_PLUGIN_ID, name: 'Integrated Weekly Review', desc: 'Whole-system signals, wins, friction, focus, and historical review snapshots.', category: 'life-os', subcategory: 'Review', downloads: '0', rating: 'New', icon: RefreshCw },
  { id: LIFE_OS_PORTABILITY_PLUGIN_ID, name: 'Data Health & Portability', desc: 'Broken-link and duplicate checks, versioned JSON backup, safe restore, and CSV or Markdown indexes.', category: 'life-os', subcategory: 'Portability', downloads: '0', rating: 'New', icon: ArrowDownToLine },
  { id: BUSINESS_DIRECTORY_PLUGIN_ID, name: 'Business Directory', desc: 'Companies, individual clients, contact details, VAT IDs, engagements, pipeline state, commercial value, and next actions.', category: 'business', subcategory: 'Administration', downloads: '0', rating: 'New', icon: Building2 },
  { id: BUSINESS_CONTRACTS_PLUGIN_ID, name: 'Proposals & Contracts', desc: 'Proposals, quotes, contracts, SOWs, NDAs, DPAs, lifecycle state, value, expiry, and note references.', category: 'business', subcategory: 'Commercial', downloads: '0', rating: 'New', icon: FileSignature },
  { id: BUSINESS_RECONCILIATION_PLUGIN_ID, name: 'Expense Inbox & Reconciliation', desc: 'Administrative matching queue for Books expenses, invoices, bank records, receipts, and supporting evidence.', category: 'business', subcategory: 'Finance Operations', downloads: '0', rating: 'New', icon: ReceiptText },
  { id: BUSINESS_OBLIGATIONS_PLUGIN_ID, name: 'Filings & Obligations', desc: 'Tax filings, insurance, registrations, renewals, reports, authorities, evidence, deadlines, and day blocks.', category: 'business', subcategory: 'Compliance', downloads: '0', rating: 'New', icon: Landmark },
  { id: BUSINESS_OPERATIONS_PLUGIN_ID, name: 'Vendors & Correspondence', desc: 'Supplier records, contracts, renewals, notice periods, incoming letters, responses, and filing state.', category: 'business', subcategory: 'Operations', downloads: '0', rating: 'New', icon: Mail },
  { id: BUSINESS_DASHBOARD_PLUGIN_ID, name: 'Business Command Center', desc: 'Clients, engagements, unpaid invoices, unbilled time, reconciliation, filings, correspondence, and administrative health.', category: 'business', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: BriefcaseBusiness },
  { id: WISHLIST_PURCHASES_PLUGIN_ID, name: 'Wishlist & Purchases', desc: 'Product comparisons, target prices, vendors, orders, returns, receipts, and warranties.', category: 'life', subcategory: 'Shopping', downloads: '0', rating: 'New', icon: ShoppingBag },
  { id: PLACES_LIBRARY_PLUGIN_ID, name: 'Places Library', desc: 'Restaurants, cafés, museums, trails, events, shops, planned visits, visit logs, and ratings.', category: 'life', subcategory: 'Places', downloads: '0', rating: 'New', icon: MapPinned },
  { id: JOURNAL_REFLECTION_PLUGIN_ID, name: 'Journal & Reflection', desc: 'Mood, energy, gratitude, prompts, highlights, lessons, and daily or periodic reflections.', category: 'life', subcategory: 'Reflection', downloads: '0', rating: 'New', icon: NotebookPen },
  { id: HOME_INVENTORY_PLUGIN_ID, name: 'Home Inventory', desc: 'Possessions, storage locations, serial numbers, receipts, lending, warranties, and insured values.', category: 'life', subcategory: 'Home', downloads: '0', rating: 'New', icon: PackageSearch },
  { id: MEAL_PLANNER_PLUGIN_ID, name: 'Meal Planner', desc: 'Weekly meals, reusable recipes, pantry-aware shopping lists, shopping trips, and day-block meal prep with portion tracking.', category: 'life', subcategory: 'Food', downloads: '0', rating: 'New', icon: Utensils },
  { id: WORKOUT_PLANNER_PLUGIN_ID, name: 'Workout Planner', desc: 'Schedule weekly strength, cardio, mobility, recovery, and sport sessions with exercises and day blocks.', category: 'life', subcategory: 'Health', downloads: '0', rating: 'New', icon: Dumbbell },
  { id: MEDIA_LIBRARY_PLUGIN_ID, name: 'Media Library', desc: 'Track written, watched, listened, played, learned, and live media with format-aware progress, ratings, and PARA links.', category: 'life', subcategory: 'Media', downloads: '0', rating: 'New', icon: BookOpen },
  ...FOUNDATION_TOOL_DEFINITIONS.map((definition) => ({
    id: definition.pluginId,
    name: definition.label,
    desc: definition.description,
    category: definition.category,
    subcategory: definition.subcategory,
    downloads: '0',
    rating: 'New',
    icon: definition.icon,
  } satisfies PluginInfo)),
  ...SELF_HOSTED_TOOL_DEFINITIONS.map((definition) => ({
    id: definition.pluginId,
    name: definition.label,
    desc: definition.description,
    category: definition.category,
    subcategory: definition.subcategory,
    downloads: '0',
    rating: 'New',
    icon: definition.icon,
  } satisfies PluginInfo)),
  ...MEDIA_TYPE_PLUGIN_DEFINITIONS.map((definition) => ({
    id: definition.pluginId,
    name: definition.label,
    desc: `A focused ${definition.label.toLowerCase()} collection backed by the shared Media Library store.`,
    category: 'media',
    subcategory: definition.family,
    downloads: '0',
    rating: 'New',
    icon: MEDIA_PLUGIN_ICONS[definition.type],
  } satisfies PluginInfo)),
  { id: EDUCATION_CORE_PLUGIN_ID, name: 'Learning Core', desc: 'Programs and courses with providers, instructors, dates, outcomes, and optional PARA relationships.', category: 'education', subcategory: 'Foundation', downloads: '0', rating: 'New', icon: GraduationCap },
  { id: EDUCATION_CURRICULUM_PLUGIN_ID, name: 'Curriculum', desc: 'Structure learning as Program → Course → Module → Lesson → Activity and track completion.', category: 'education', subcategory: 'Structure', downloads: '0', rating: 'New', icon: ListTree },
  { id: EDUCATION_STUDY_PLUGIN_ID, name: 'Study Planner', desc: 'Plan study sessions into the shared day blocks and track completed learning time.', category: 'education', subcategory: 'Planning', downloads: '0', rating: 'New', icon: CalendarClock },
  { id: EDUCATION_ASSIGNMENTS_PLUGIN_ID, name: 'Assignments & Assessments', desc: 'Track exercises, assignments, exams, projects, deadlines, submissions, scores, and feedback.', category: 'education', subcategory: 'Assessment', downloads: '0', rating: 'New', icon: ClipboardCheck },
  { id: EDUCATION_DASHBOARD_PLUGIN_ID, name: 'Education Dashboard', desc: 'Active learning, weekly study time, planned sessions, upcoming work, overdue deadlines, and progress.', category: 'education', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: INFORMATION_INTAKE_PLUGIN_ID, name: 'Information Intake Router', desc: 'Capture signals, questions, problems, and ideas, then route them by intent through the ten Information Intake Modes.', category: 'research', subcategory: 'Intake', downloads: '0', rating: 'New', icon: ScanSearch },
  { id: INFORMATION_WORKBENCH_PLUGIN_ID, name: 'Mode Workbench', desc: 'Mode-specific guiding questions, timeboxes, day blocks, stopping rules, session logs, and downstream transitions.', category: 'research', subcategory: 'Execution', downloads: '0', rating: 'New', icon: Compass },
  { id: INFORMATION_OUTPUTS_PLUGIN_ID, name: 'Information Outputs', desc: 'Research bundles, decisions, matrices, solution notes, creations, playbooks, retrieval packs, iteration logs, and reviews.', category: 'research', subcategory: 'Knowledge', downloads: '0', rating: 'New', icon: FileText },
  { id: PARA_CORE_PLUGIN_ID, name: 'Modified PARA Core', desc: 'Canonical Projects, Areas, Resources, and lifecycle Archive with stable IDs and cross-links.', category: 'para', subcategory: 'Foundation', downloads: '0', rating: 'New', icon: Compass },
  { id: PARA_CAPTURE_PLUGIN_ID, name: 'PARA Capture & Router', desc: 'A universal inbox that routes raw captures into Tasks, Projects, Areas, or Resources.', category: 'para', subcategory: 'Capture', downloads: '0', rating: 'New', icon: ListFilter },
  { id: PARA_TASKS_PLUGIN_ID, name: 'PARA Tasks', desc: 'Next actions with projects, areas, do dates, deadlines, contexts, energy, priority, and waiting states.', category: 'para', subcategory: 'Execution', downloads: '0', rating: 'New', icon: ListTodo },
  { id: PARA_GOALS_PLUGIN_ID, name: 'Goals & Arcs', desc: 'Quarterly direction spanning multiple subareas without turning goals into another task list.', category: 'para', subcategory: 'Direction', downloads: '0', rating: 'New', icon: Target },
  { id: PARA_REVIEW_PLUGIN_ID, name: 'PARA Review Engine', desc: 'Daily and weekly maintenance with stalled-project, neglected-area, inbox, and orphan-resource signals.', category: 'para', subcategory: 'Maintenance', downloads: '0', rating: 'New', icon: RefreshCw },
  { id: PARA_DASHBOARD_PLUGIN_ID, name: 'Life Command Center', desc: 'One read-only dashboard for PARA direction, today, routines, meals, workouts, upcoming commitments, and time-sensitive Life items.', category: 'para', subcategory: 'Dashboard', downloads: '0', rating: 'New', icon: LayoutDashboard },
  { id: PARA_MIGRATION_PLUGIN_ID, name: 'Notion PARA Migrator', desc: 'Dry-run and import Notion CSV/Markdown exports with stable source IDs, relation recovery, and repeatable merges.', category: 'para', subcategory: 'Migration', downloads: '0', rating: 'New', icon: ArrowDownToLine },
  { id: 'kanban', name: 'Engagement Pipeline', desc: 'Drag-and-drop board: engagement notes move through configurable stages (Inquiry → Scoping → Audit → Report → Fix Review → Final).', category: 'audit', subcategory: 'Pipeline', downloads: '9.7k', rating: '4.6', icon: SquareKanban },
];

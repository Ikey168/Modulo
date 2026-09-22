import { AWARENESS_PLUGINS } from '../awareness/plugins';
import { RESEARCH_ROLES, RESEARCH_ROLE_IDS } from '../researchRoles';
// The plugin catalog: marketplace metadata (from plugins.ts) enriched with
// dependencies and lazy loaders. Every marketplace entry is runnable; keeping
// the metadata and code maps separate preserves lazy-loading and install state.

import {
  AUDIT_CORE_BROWSER_PLUGIN_ID,
  AUDIT_CORE_FINDINGS_PLUGIN_ID,
  AUDIT_CORE_OVERVIEW_PLUGIN_ID,
  AUDIT_CORE_REMEDIATION_PLUGIN_ID,
  AUDIT_CORE_REPORT_PLUGIN_ID,
  AUDIT_CORE_SCOPE_PLUGIN_ID,
  AUDIT_CORE_TESTS_PLUGIN_ID,
  AUDIT_CORE_THREATS_PLUGIN_ID,
  CAREER_DASHBOARD_PLUGIN_ID,
  CAREER_DEVELOPMENT_PLUGIN_ID,
  CAREER_OPPORTUNITIES_PLUGIN_ID,
  CAREER_PORTFOLIO_PLUGIN_ID,
  BUSINESS_CONTRACTS_PLUGIN_ID,
  BUSINESS_DASHBOARD_PLUGIN_ID,
  BUSINESS_DIRECTORY_PLUGIN_ID,
  BUSINESS_OBLIGATIONS_PLUGIN_ID,
  BUSINESS_OPERATIONS_PLUGIN_ID,
  BUSINESS_RECONCILIATION_PLUGIN_ID,
  CALENDAR_PLUGIN_ID,
  CANVAS_PLUGIN_ID,
  CHECKLISTS_PLUGIN_ID,
  DATABASE_PLUGIN_ID,
  EDUCATION_ASSIGNMENTS_PLUGIN_ID,
  EDUCATION_CORE_PLUGIN_ID,
  EDUCATION_CURRICULUM_PLUGIN_ID,
  EDUCATION_DASHBOARD_PLUGIN_ID,
  EDUCATION_STUDY_PLUGIN_ID,
  EVIDENCE_CLAIMS_PLUGIN_ID,
  EVIDENCE_DASHBOARD_PLUGIN_ID,
  EVIDENCE_LIBRARY_PLUGIN_ID,
  EVIDENCE_REPRO_PLUGIN_ID,
  ELECTRONICS_DASHBOARD_PLUGIN_ID,
  ELECTRONICS_LAB_PLUGIN_ID,
  ELECTRONICS_PARTS_PLUGIN_ID,
  ELECTRONICS_PROJECTS_PLUGIN_ID,
  EUER_PLUGIN_ID,
  FINDINGS_PLUGIN_ID,
  GOBD_PLUGIN_ID,
  PAPERLESS_PLUGIN_ID,
  PAPERLESS_ACTIONS_PLUGIN_ID,
  GRAPH_PLUGIN_ID,
  HEALTH_TRACKER_PLUGIN_ID,
  HOBBY_STUDIO_PLUGIN_ID,
  HOBBY_STACK_PLUGIN_ID,
  HOBBY_PRACTICE_PLUGIN_ID,
  HOBBY_FUN_PLUGIN_ID,
  HOBBY_DASHBOARD_PLUGIN_ID,
  HOME_INVENTORY_PLUGIN_ID,
  HOME_MAINTENANCE_PLUGIN_ID,
  HOMELAB_ASSETS_PLUGIN_ID,
  HOMELAB_OPERATIONS_PLUGIN_ID,
  HOMELAB_DASHBOARD_PLUGIN_ID,
  INFORMATION_DASHBOARD_PLUGIN_ID,
  INFORMATION_INTAKE_PLUGIN_ID,
  INFORMATION_OUTPUTS_PLUGIN_ID,
  INFORMATION_WORKBENCH_PLUGIN_ID,
  RESEARCH_WORKFLOW_ENGINE_PLUGIN_ID,
  AI_SUMMARY_PLUGIN_ID,
  AUTO_LINKER_PLUGIN_ID,
  FOCUS_PLUGIN_ID,
  GITHUB_SYNC_PLUGIN_ID,
  GRAPH_STATS_PLUGIN_ID,
  IPFS_ATTACH_PLUGIN_ID,
  LATEX_PLUGIN_ID,
  MERMAID_PLUGIN_ID,
  PDF_EXPORT_PLUGIN_ID,
  SEMANTIC_SEARCH_PLUGIN_ID,
  TIMESTAMP_PROOFS_PLUGIN_ID,
  WEB3_ID_PLUGIN_ID,
  JOURNAL_REFLECTION_PLUGIN_ID,
  LIFE_OS_DASHBOARD_PLUGIN_ID,
  LIFE_OS_EXPLORER_PLUGIN_ID,
  LIFE_OS_PORTABILITY_PLUGIN_ID,
  LIFE_OS_RELATIONS_PLUGIN_ID,
  LIFE_OS_REVIEW_PLUGIN_ID,
  MEAL_PLANNER_PLUGIN_ID,
  MEDIA_LIBRARY_PLUGIN_ID,
  MOBILITY_DASHBOARD_PLUGIN_ID,
  MOBILITY_DOCUMENTS_PLUGIN_ID,
  MOBILITY_OPERATIONS_PLUGIN_ID,
  MOBILITY_VEHICLES_PLUGIN_ID,
  MUSIC_DASHBOARD_PLUGIN_ID,
  MUSIC_LIBRARY_PLUGIN_ID,
  MUSIC_PRACTICE_PLUGIN_ID,
  MUSIC_PROJECTS_PLUGIN_ID,
  NOTES_PLUGIN_ID,
  OUTLINE_PLUGIN_ID,
  PARA_CAPTURE_PLUGIN_ID,
  PARA_CORE_PLUGIN_ID,
  PARA_DASHBOARD_PLUGIN_ID,
  PARA_GOALS_PLUGIN_ID,
  PARA_MIGRATION_PLUGIN_ID,
  PLANNER_PLUGIN_ID,
  PARA_REVIEW_PLUGIN_ID,
  PARA_TASKS_PLUGIN_ID,
  PERSONAL_CRM_PLUGIN_ID,
  PLACES_LIBRARY_PLUGIN_ID,
  PLUGINS,
  RECHNUNG_PLUGIN_ID,
  REPORTS_PLUGIN_ID,
  ROUTINES_PLUGIN_ID,
  PERSONAL_SOPS_PLUGIN_ID,
  SECURITY_DASHBOARD_PLUGIN_ID,
  SECURITY_INCIDENTS_PLUGIN_ID,
  SECURITY_INVENTORY_PLUGIN_ID,
  SECURITY_RESILIENCE_PLUGIN_ID,
  STYLE_STUDIO_PLUGIN_ID,
  SAVED_SEARCHES_PLUGIN_ID,
  TAGS_PLUGIN_ID,
  TIMELINE_PLUGIN_ID,
  TODO_PLUGIN_ID,
  TRAVEL_PLANNER_PLUGIN_ID,
  VULN_KB_PLUGIN_ID,
  WORKOUT_PLANNER_PLUGIN_ID,
  WEALTH_BALANCE_PLUGIN_ID,
  WEALTH_CASHFLOW_PLUGIN_ID,
  WEALTH_DASHBOARD_PLUGIN_ID,
  WEALTH_INVESTMENTS_PLUGIN_ID,
  WARDROBE_CLOSET_PLUGIN_ID,
  WARDROBE_DASHBOARD_PLUGIN_ID,
  TTRPG_CAMPAIGNS_PLUGIN_ID,
  TTRPG_WORLD_PLUGIN_ID,
  TTRPG_SESSIONS_PLUGIN_ID,
  TTRPG_DASHBOARD_PLUGIN_ID,
  WISHLIST_PURCHASES_PLUGIN_ID,
  ZEITERFASSUNG_PLUGIN_ID,
  FINANCE_SUBSCRIPTIONS_PLUGIN_ID,
  WRITING_DASHBOARD_PLUGIN_ID,
  WRITING_EDITORIAL_PLUGIN_ID,
  WRITING_MANUSCRIPTS_PLUGIN_ID,
  WRITING_PUBLISHING_PLUGIN_ID,
} from '../plugins';
import { MEDIA_TYPE_PLUGIN_DEFINITIONS } from '../mediaLibrary';
import {
  CITATION_MANAGER_PLUGIN_ID,
  DECISION_JOURNAL_PLUGIN_ID,
  SKILL_TREE_PLUGIN_ID,
  FLASHCARDS_PLUGIN_ID,
  FOUNDATION_TOOL_DEFINITIONS,
  LEARNING_GOALS_PLUGIN_ID,
  LISTS_RANKINGS_PLUGIN_ID,
  MEDIA_DIARY_PLUGIN_ID,
  METADATA_RESOLVER_PLUGIN_ID,
  READING_ANNOTATIONS_PLUGIN_ID,
  READ_LATER_PLUGIN_ID,
  REMINDERS_PLUGIN_ID,
  UNIVERSAL_ATTACHMENTS_PLUGIN_ID,
} from '../foundationTools';
import {
  CALDAV_SYNC_PLUGIN_ID,
  DOCUMENT_INBOX_PLUGIN_ID,
  FEEDS_READING_PLUGIN_ID,
  MANAGED_FILES_PLUGIN_ID,
  NOTIFICATION_GATEWAY_PLUGIN_ID,
  PDF_TOOLKIT_PLUGIN_ID,
  SELF_HOSTED_TOOL_DEFINITIONS,
  WEB_ARCHIVE_PLUGIN_ID,
  WEB_WATCH_PLUGIN_ID,
} from '../selfHostedTools';
import type { PluginManifest, PluginModule } from './types';
import { WORKSPACE_TOOLS } from '../workspaceTools/definitions';

interface Runnable {
  builtin?: boolean;
  dependencies?: string[];
  load: () => Promise<{ default: PluginModule }>;
}

const collection = (id: string, mode: string, order: number): Runnable => ({
  load: () => import('./builtins/domainPackPlugins').then((module) => ({ default: module.collectionPlugin(id, mode, order) })),
});
const dashboard = (id: string, dependencies: string[]): Runnable => ({
  dependencies,
  load: () => import('./builtins/domainPackPlugins').then((module) => ({ default: module.dashboardPlugin(id) })),
});
const advanced = (name: keyof typeof import('./builtins/advancedPlugins'), dependencies: string[] = []): Runnable => ({
  dependencies,
  load: () => import('./builtins/advancedPlugins').then((module) => ({ default: module[name] })),
});
const FOUNDATION_DEPENDENCIES: Record<string, string[]> = {
  [METADATA_RESOLVER_PLUGIN_ID]: [MEDIA_LIBRARY_PLUGIN_ID],
  [MEDIA_DIARY_PLUGIN_ID]: [MEDIA_LIBRARY_PLUGIN_ID],
  [LISTS_RANKINGS_PLUGIN_ID]: [MEDIA_LIBRARY_PLUGIN_ID],
  [UNIVERSAL_ATTACHMENTS_PLUGIN_ID]: [],
  [REMINDERS_PLUGIN_ID]: [PLANNER_PLUGIN_ID],
  [READING_ANNOTATIONS_PLUGIN_ID]: [MEDIA_LIBRARY_PLUGIN_ID],
  [FLASHCARDS_PLUGIN_ID]: [EDUCATION_CORE_PLUGIN_ID],
  [LEARNING_GOALS_PLUGIN_ID]: [EDUCATION_CORE_PLUGIN_ID, PARA_CORE_PLUGIN_ID],
  [READ_LATER_PLUGIN_ID]: [],
  [CITATION_MANAGER_PLUGIN_ID]: [EVIDENCE_LIBRARY_PLUGIN_ID],
};
const SELF_HOSTED_DEPENDENCIES: Record<string, string[]> = {
  [FEEDS_READING_PLUGIN_ID]: [READ_LATER_PLUGIN_ID],
  [WEB_ARCHIVE_PLUGIN_ID]: [READ_LATER_PLUGIN_ID, UNIVERSAL_ATTACHMENTS_PLUGIN_ID],
  [WEB_WATCH_PLUGIN_ID]: [REMINDERS_PLUGIN_ID],
  [DOCUMENT_INBOX_PLUGIN_ID]: [UNIVERSAL_ATTACHMENTS_PLUGIN_ID],
  [PDF_TOOLKIT_PLUGIN_ID]: [UNIVERSAL_ATTACHMENTS_PLUGIN_ID],
  [MANAGED_FILES_PLUGIN_ID]: [UNIVERSAL_ATTACHMENTS_PLUGIN_ID],
  [CALDAV_SYNC_PLUGIN_ID]: [PLANNER_PLUGIN_ID, CALENDAR_PLUGIN_ID],
  [NOTIFICATION_GATEWAY_PLUGIN_ID]: [REMINDERS_PLUGIN_ID],
};

// Notes + Graph ship pre-installed. Other tools are installed on demand with
// explicit dependencies so their host surfaces always exist.
const RUNNABLE: Record<string, Runnable> = {
  ...Object.fromEntries(AWARENESS_PLUGINS.map(plugin => [plugin.id, {
    dependencies: plugin.id === 'daily-briefing' ? ['topic-watchlists'] : plugin.id === 'topic-watchlists' ? ['newsletter-inbox', FEEDS_READING_PLUGIN_ID, WEB_WATCH_PLUGIN_ID, PARA_CORE_PLUGIN_ID] : [NOTES_PLUGIN_ID],
    load: () => import('../awareness/plugins').then(async module => ({ default: await module.awarenessPlugin(plugin.id) })),
  } satisfies Runnable])),
  ...Object.fromEntries(WORKSPACE_TOOLS.map(tool => [tool.id, {
    dependencies: tool.id === 'project-workspaces' ? [NOTES_PLUGIN_ID, 'decision-journal', 'executable-runbooks', 'workspace-capsules'] : [NOTES_PLUGIN_ID],
    load: () => import('../workspaceTools/plugin').then(async module => ({ default: await module.workspaceToolPlugin(tool.id) })),
  } satisfies Runnable])),
  [LATEX_PLUGIN_ID]: advanced('latexPlugin', [NOTES_PLUGIN_ID]),
  [AI_SUMMARY_PLUGIN_ID]: advanced('aiSummaryPlugin', [NOTES_PLUGIN_ID]),
  [GITHUB_SYNC_PLUGIN_ID]: advanced('githubSyncPlugin', [NOTES_PLUGIN_ID]),
  [MERMAID_PLUGIN_ID]: advanced('mermaidPlugin', [NOTES_PLUGIN_ID]),
  [PDF_EXPORT_PLUGIN_ID]: advanced('pdfExportPlugin', [NOTES_PLUGIN_ID]),
  [GRAPH_STATS_PLUGIN_ID]: advanced('graphStatsPlugin', [GRAPH_PLUGIN_ID]),
  [WEB3_ID_PLUGIN_ID]: advanced('web3IdentityPlugin'),
  [FOCUS_PLUGIN_ID]: advanced('focusPlugin'),
  [IPFS_ATTACH_PLUGIN_ID]: advanced('ipfsAttachPlugin', [NOTES_PLUGIN_ID]),
  [TIMESTAMP_PROOFS_PLUGIN_ID]: advanced('timestampProofsPlugin', [NOTES_PLUGIN_ID]),
  [SEMANTIC_SEARCH_PLUGIN_ID]: advanced('semanticSearchPlugin', [NOTES_PLUGIN_ID]),
  [AUTO_LINKER_PLUGIN_ID]: advanced('autoLinkerPlugin', [NOTES_PLUGIN_ID]),
  [AUDIT_CORE_BROWSER_PLUGIN_ID]: { load: () => import('./builtins/auditCoreBrowserPlugin') },
  [AUDIT_CORE_OVERVIEW_PLUGIN_ID]: { dependencies: [AUDIT_CORE_BROWSER_PLUGIN_ID], load: () => import('./builtins/auditCoreOverviewPlugin') },
  [AUDIT_CORE_SCOPE_PLUGIN_ID]: { dependencies: [AUDIT_CORE_BROWSER_PLUGIN_ID], load: () => import('./builtins/auditCoreScopePlugin') },
  [AUDIT_CORE_THREATS_PLUGIN_ID]: { dependencies: [AUDIT_CORE_BROWSER_PLUGIN_ID], load: () => import('./builtins/auditCoreThreatsPlugin') },
  [AUDIT_CORE_FINDINGS_PLUGIN_ID]: { dependencies: [AUDIT_CORE_BROWSER_PLUGIN_ID], load: () => import('./builtins/auditCoreFindingsPlugin') },
  [AUDIT_CORE_TESTS_PLUGIN_ID]: { dependencies: [AUDIT_CORE_BROWSER_PLUGIN_ID], load: () => import('./builtins/auditCoreTestsPlugin') },
  [AUDIT_CORE_REPORT_PLUGIN_ID]: { dependencies: [AUDIT_CORE_BROWSER_PLUGIN_ID], load: () => import('./builtins/auditCoreReportPlugin') },
  [AUDIT_CORE_REMEDIATION_PLUGIN_ID]: { dependencies: [AUDIT_CORE_BROWSER_PLUGIN_ID], load: () => import('./builtins/auditCoreRemediationPlugin') },
  [SECURITY_INVENTORY_PLUGIN_ID]: collection(SECURITY_INVENTORY_PLUGIN_ID, 'security', 20),
  [SECURITY_RESILIENCE_PLUGIN_ID]: collection(SECURITY_RESILIENCE_PLUGIN_ID, 'security', 30),
  [SECURITY_INCIDENTS_PLUGIN_ID]: collection(SECURITY_INCIDENTS_PLUGIN_ID, 'security', 40),
  [SECURITY_DASHBOARD_PLUGIN_ID]: dashboard('security', [SECURITY_INVENTORY_PLUGIN_ID, SECURITY_RESILIENCE_PLUGIN_ID, SECURITY_INCIDENTS_PLUGIN_ID]),
  [WEALTH_BALANCE_PLUGIN_ID]: collection(WEALTH_BALANCE_PLUGIN_ID, 'wealth', 20),
  [WEALTH_CASHFLOW_PLUGIN_ID]: collection(WEALTH_CASHFLOW_PLUGIN_ID, 'wealth', 30),
  [WEALTH_INVESTMENTS_PLUGIN_ID]: collection(WEALTH_INVESTMENTS_PLUGIN_ID, 'wealth', 40),
  [WEALTH_DASHBOARD_PLUGIN_ID]: dashboard('wealth', [WEALTH_BALANCE_PLUGIN_ID, WEALTH_CASHFLOW_PLUGIN_ID, WEALTH_INVESTMENTS_PLUGIN_ID]),
  [EVIDENCE_LIBRARY_PLUGIN_ID]: collection(EVIDENCE_LIBRARY_PLUGIN_ID, 'evidence', 20),
  [EVIDENCE_CLAIMS_PLUGIN_ID]: collection(EVIDENCE_CLAIMS_PLUGIN_ID, 'evidence', 30),
  [EVIDENCE_REPRO_PLUGIN_ID]: collection(EVIDENCE_REPRO_PLUGIN_ID, 'evidence', 40),
  [EVIDENCE_DASHBOARD_PLUGIN_ID]: dashboard('evidence', [EVIDENCE_LIBRARY_PLUGIN_ID, EVIDENCE_CLAIMS_PLUGIN_ID, EVIDENCE_REPRO_PLUGIN_ID]),
  [CAREER_PORTFOLIO_PLUGIN_ID]: collection(CAREER_PORTFOLIO_PLUGIN_ID, 'career', 20),
  [CAREER_OPPORTUNITIES_PLUGIN_ID]: collection(CAREER_OPPORTUNITIES_PLUGIN_ID, 'career', 30),
  [CAREER_DEVELOPMENT_PLUGIN_ID]: collection(CAREER_DEVELOPMENT_PLUGIN_ID, 'career', 40),
  [CAREER_DASHBOARD_PLUGIN_ID]: dashboard('career', [CAREER_PORTFOLIO_PLUGIN_ID, CAREER_OPPORTUNITIES_PLUGIN_ID, CAREER_DEVELOPMENT_PLUGIN_ID]),
  [WRITING_MANUSCRIPTS_PLUGIN_ID]: collection(WRITING_MANUSCRIPTS_PLUGIN_ID, 'writing', 20),
  [WRITING_EDITORIAL_PLUGIN_ID]: collection(WRITING_EDITORIAL_PLUGIN_ID, 'writing', 30),
  [WRITING_PUBLISHING_PLUGIN_ID]: collection(WRITING_PUBLISHING_PLUGIN_ID, 'writing', 40),
  [WRITING_DASHBOARD_PLUGIN_ID]: dashboard('writing', [WRITING_MANUSCRIPTS_PLUGIN_ID, WRITING_EDITORIAL_PLUGIN_ID, WRITING_PUBLISHING_PLUGIN_ID]),
  [MOBILITY_VEHICLES_PLUGIN_ID]: collection(MOBILITY_VEHICLES_PLUGIN_ID, 'mobility', 20),
  [MOBILITY_OPERATIONS_PLUGIN_ID]: collection(MOBILITY_OPERATIONS_PLUGIN_ID, 'mobility', 30),
  [MOBILITY_DOCUMENTS_PLUGIN_ID]: collection(MOBILITY_DOCUMENTS_PLUGIN_ID, 'mobility', 40),
  [MOBILITY_DASHBOARD_PLUGIN_ID]: dashboard('mobility', [MOBILITY_VEHICLES_PLUGIN_ID, MOBILITY_OPERATIONS_PLUGIN_ID, MOBILITY_DOCUMENTS_PLUGIN_ID, TRAVEL_PLANNER_PLUGIN_ID]),
  [NOTES_PLUGIN_ID]: {
    builtin: true,
    load: () => import('./builtins/notesPlugin'),
  },
  [GRAPH_PLUGIN_ID]: {
    builtin: true,
    load: () => import('./builtins/graphPlugin'),
  },
  [OUTLINE_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/outlinePlugin'),
  },
  [DATABASE_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/databasePlugin'),
  },
  [CANVAS_PLUGIN_ID]: {
    load: () => import('./builtins/canvasPlugin'),
  },
  [CALENDAR_PLUGIN_ID]: {
    dependencies: [PLANNER_PLUGIN_ID],
    load: () => import('./builtins/calendarPlugin'),
  },
  [TIMELINE_PLUGIN_ID]: {
    load: () => import('./builtins/timelinePlugin'),
  },
  [TAGS_PLUGIN_ID]: {
    load: () => import('./builtins/tagExplorerPlugin'),
  },
  [SAVED_SEARCHES_PLUGIN_ID]: {
    load: () => import('./builtins/savedSearchesPlugin'),
  },
  [FINDINGS_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/findingsPlugin'),
  },
  kanban: {
    load: () => import('./builtins/kanbanPlugin'),
  },
  [CHECKLISTS_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/checklistsPlugin'),
  },
  [VULN_KB_PLUGIN_ID]: {
    dependencies: [FINDINGS_PLUGIN_ID],
    load: () => import('./builtins/vulnKbPlugin'),
  },
  [REPORTS_PLUGIN_ID]: {
    dependencies: [FINDINGS_PLUGIN_ID],
    load: () => import('./builtins/reportsPlugin'),
  },
  [RECHNUNG_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/rechnungPlugin'),
  },
  [ZEITERFASSUNG_PLUGIN_ID]: {
    load: () => import('./builtins/zeiterfassungPlugin'),
  },
  [EUER_PLUGIN_ID]: {
    dependencies: [RECHNUNG_PLUGIN_ID],
    load: () => import('./builtins/euerPlugin'),
  },
  [GOBD_PLUGIN_ID]: {
    load: () => import('./builtins/gobdPlugin'),
  },
  [PAPERLESS_PLUGIN_ID]: {
    dependencies: [PAPERLESS_ACTIONS_PLUGIN_ID, PARA_CORE_PLUGIN_ID, PARA_TASKS_PLUGIN_ID],
    load: () => import('./builtins/paperlessPlugin'),
  },
  [PAPERLESS_ACTIONS_PLUGIN_ID]: {
    load: () => import('./builtins/paperlessActionsPlugin'),
  },
  [BUSINESS_DIRECTORY_PLUGIN_ID]: { load: () => import('./builtins/businessDirectoryPlugin') },
  [BUSINESS_CONTRACTS_PLUGIN_ID]: { dependencies: [BUSINESS_DIRECTORY_PLUGIN_ID], load: () => import('./builtins/businessContractsPlugin') },
  [BUSINESS_RECONCILIATION_PLUGIN_ID]: { dependencies: [RECHNUNG_PLUGIN_ID, EUER_PLUGIN_ID], load: () => import('./builtins/businessReconciliationPlugin') },
  [BUSINESS_OBLIGATIONS_PLUGIN_ID]: { dependencies: [PLANNER_PLUGIN_ID], load: () => import('./builtins/businessObligationsPlugin') },
  [BUSINESS_OPERATIONS_PLUGIN_ID]: { dependencies: [BUSINESS_DIRECTORY_PLUGIN_ID, PLANNER_PLUGIN_ID], load: () => import('./builtins/businessOperationsPlugin') },
  [BUSINESS_DASHBOARD_PLUGIN_ID]: { dependencies: [BUSINESS_DIRECTORY_PLUGIN_ID, BUSINESS_CONTRACTS_PLUGIN_ID, BUSINESS_RECONCILIATION_PLUGIN_ID, BUSINESS_OBLIGATIONS_PLUGIN_ID, BUSINESS_OPERATIONS_PLUGIN_ID, RECHNUNG_PLUGIN_ID, ZEITERFASSUNG_PLUGIN_ID, EUER_PLUGIN_ID, GOBD_PLUGIN_ID], load: () => import('./builtins/businessDashboardPlugin') },
  [PLANNER_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/plannerPlugin'),
  },
  [PERSONAL_SOPS_PLUGIN_ID]: { dependencies: [NOTES_PLUGIN_ID], load: () => import('./builtins/personalSopsPlugin') },
  [ROUTINES_PLUGIN_ID]: {
    dependencies: [PLANNER_PLUGIN_ID],
    load: () => import('./builtins/routinesHabitsPlugin'),
  },
  [HOME_MAINTENANCE_PLUGIN_ID]: { load: () => import('./builtins/homeMaintenancePlugin') },
  [PERSONAL_CRM_PLUGIN_ID]: { load: () => import('./builtins/personalCrmPlugin') },
  [FINANCE_SUBSCRIPTIONS_PLUGIN_ID]: { load: () => import('./builtins/financeSubscriptionsPlugin') },
  [TRAVEL_PLANNER_PLUGIN_ID]: { load: () => import('./builtins/travelPlannerPlugin') },
  [HEALTH_TRACKER_PLUGIN_ID]: { load: () => import('./builtins/healthTrackerPlugin') },
  [HOBBY_STUDIO_PLUGIN_ID]: { load: () => import('./builtins/hobbyStudioPlugin') },
  [HOBBY_STACK_PLUGIN_ID]: { load: () => import('./builtins/hobbyStackPlugin') },
  [HOBBY_PRACTICE_PLUGIN_ID]: { dependencies: [HOBBY_STACK_PLUGIN_ID, PLANNER_PLUGIN_ID], load: () => import('./builtins/hobbyPracticePlugin') },
  [HOBBY_FUN_PLUGIN_ID]: { dependencies: [HOBBY_STACK_PLUGIN_ID], load: () => import('./builtins/hobbyFunPlugin') },
  [HOBBY_DASHBOARD_PLUGIN_ID]: { dependencies: [HOBBY_STACK_PLUGIN_ID, HOBBY_PRACTICE_PLUGIN_ID, HOBBY_FUN_PLUGIN_ID], load: () => import('./builtins/hobbyDashboardPlugin') },
  [MUSIC_PROJECTS_PLUGIN_ID]: { dependencies: [HOBBY_STACK_PLUGIN_ID], load: () => import('./builtins/musicProjectsPlugin') },
  [MUSIC_PRACTICE_PLUGIN_ID]: { dependencies: [MUSIC_PROJECTS_PLUGIN_ID, PLANNER_PLUGIN_ID], load: () => import('./builtins/musicPracticePlugin') },
  [MUSIC_LIBRARY_PLUGIN_ID]: { dependencies: [MUSIC_PROJECTS_PLUGIN_ID], load: () => import('./builtins/musicAssetsPlugin') },
  [MUSIC_DASHBOARD_PLUGIN_ID]: { dependencies: [MUSIC_PROJECTS_PLUGIN_ID, MUSIC_PRACTICE_PLUGIN_ID, MUSIC_LIBRARY_PLUGIN_ID], load: () => import('./builtins/musicDashboardPlugin') },
  [ELECTRONICS_PROJECTS_PLUGIN_ID]: { dependencies: [HOBBY_STACK_PLUGIN_ID], load: () => import('./builtins/electronicsProjectsPlugin') },
  [ELECTRONICS_PARTS_PLUGIN_ID]: { dependencies: [ELECTRONICS_PROJECTS_PLUGIN_ID], load: () => import('./builtins/electronicsPartsPlugin') },
  [ELECTRONICS_LAB_PLUGIN_ID]: { dependencies: [ELECTRONICS_PROJECTS_PLUGIN_ID, PLANNER_PLUGIN_ID], load: () => import('./builtins/electronicsLabPlugin') },
  [ELECTRONICS_DASHBOARD_PLUGIN_ID]: { dependencies: [ELECTRONICS_PROJECTS_PLUGIN_ID, ELECTRONICS_PARTS_PLUGIN_ID, ELECTRONICS_LAB_PLUGIN_ID], load: () => import('./builtins/electronicsDashboardPlugin') },
  [HOMELAB_ASSETS_PLUGIN_ID]: { dependencies: [HOBBY_STACK_PLUGIN_ID], load: () => import('./builtins/homelabAssetsPlugin') },
  [HOMELAB_OPERATIONS_PLUGIN_ID]: { dependencies: [HOMELAB_ASSETS_PLUGIN_ID, PLANNER_PLUGIN_ID], load: () => import('./builtins/homelabOperationsPlugin') },
  [HOMELAB_DASHBOARD_PLUGIN_ID]: { dependencies: [HOMELAB_ASSETS_PLUGIN_ID, HOMELAB_OPERATIONS_PLUGIN_ID], load: () => import('./builtins/homelabDashboardPlugin') },
  [WARDROBE_CLOSET_PLUGIN_ID]: { dependencies: [HOBBY_STACK_PLUGIN_ID], load: () => import('./builtins/wardrobeClosetPlugin') },
  [STYLE_STUDIO_PLUGIN_ID]: { dependencies: [WARDROBE_CLOSET_PLUGIN_ID, PLANNER_PLUGIN_ID], load: () => import('./builtins/styleStudioPlugin') },
  [WARDROBE_DASHBOARD_PLUGIN_ID]: { dependencies: [WARDROBE_CLOSET_PLUGIN_ID, STYLE_STUDIO_PLUGIN_ID], load: () => import('./builtins/wardrobeDashboardPlugin') },
  [TTRPG_CAMPAIGNS_PLUGIN_ID]: { dependencies: [HOBBY_STACK_PLUGIN_ID], load: () => import('./builtins/ttrpgCampaignsPlugin') },
  [TTRPG_WORLD_PLUGIN_ID]: { dependencies: [TTRPG_CAMPAIGNS_PLUGIN_ID], load: () => import('./builtins/ttrpgWorldPlugin') },
  [TTRPG_SESSIONS_PLUGIN_ID]: { dependencies: [TTRPG_CAMPAIGNS_PLUGIN_ID, PLANNER_PLUGIN_ID], load: () => import('./builtins/ttrpgSessionsPlugin') },
  [TTRPG_DASHBOARD_PLUGIN_ID]: { dependencies: [TTRPG_CAMPAIGNS_PLUGIN_ID, TTRPG_WORLD_PLUGIN_ID, TTRPG_SESSIONS_PLUGIN_ID], load: () => import('./builtins/ttrpgDashboardPlugin') },
  [LIFE_OS_EXPLORER_PLUGIN_ID]: { load: () => import('./builtins/lifeOsExplorerPlugin') },
  [LIFE_OS_RELATIONS_PLUGIN_ID]: { dependencies: [LIFE_OS_EXPLORER_PLUGIN_ID], load: () => import('./builtins/lifeOsRelationsPlugin') },
  [LIFE_OS_REVIEW_PLUGIN_ID]: { dependencies: [LIFE_OS_EXPLORER_PLUGIN_ID], load: () => import('./builtins/lifeOsReviewPlugin') },
  [LIFE_OS_PORTABILITY_PLUGIN_ID]: { dependencies: [LIFE_OS_EXPLORER_PLUGIN_ID], load: () => import('./builtins/lifeOsPortabilityPlugin') },
  [LIFE_OS_DASHBOARD_PLUGIN_ID]: { dependencies: [LIFE_OS_EXPLORER_PLUGIN_ID, LIFE_OS_RELATIONS_PLUGIN_ID, LIFE_OS_REVIEW_PLUGIN_ID, LIFE_OS_PORTABILITY_PLUGIN_ID], load: () => import('./builtins/lifeOsDashboardPlugin') },
  [WISHLIST_PURCHASES_PLUGIN_ID]: { load: () => import('./builtins/wishlistPurchasesPlugin') },
  [PLACES_LIBRARY_PLUGIN_ID]: { load: () => import('./builtins/placesLibraryPlugin') },
  [JOURNAL_REFLECTION_PLUGIN_ID]: { load: () => import('./builtins/journalReflectionPlugin') },
  [HOME_INVENTORY_PLUGIN_ID]: { load: () => import('./builtins/homeInventoryPlugin') },
  [TODO_PLUGIN_ID]: {
    load: () => import('./builtins/todoPlugin'),
  },
  'webhook-trigger': {
    load: () => import('./builtins/webhookTriggerPlugin'),
  },
  'tax-automation': {
    load: () => import('./builtins/taxAutomationPlugin'),
  },
  'scheduled-digest': {
    load: () => import('./builtins/scheduledDigestPlugin'),
  },
  'noesis-brief': {
    load: () => import('./builtins/noesisBriefPlugin'),
  },
  [PARA_CORE_PLUGIN_ID]: {
    load: () => import('./builtins/paraCorePlugin'),
  },
  [PARA_CAPTURE_PLUGIN_ID]: {
    dependencies: [PARA_CORE_PLUGIN_ID, PARA_TASKS_PLUGIN_ID],
    load: () => import('./builtins/paraCapturePlugin'),
  },
  [PARA_TASKS_PLUGIN_ID]: {
    dependencies: [PARA_CORE_PLUGIN_ID],
    load: () => import('./builtins/paraTasksPlugin'),
  },
  [PARA_GOALS_PLUGIN_ID]: {
    dependencies: [PARA_CORE_PLUGIN_ID],
    load: () => import('./builtins/paraGoalsPlugin'),
  },
  [PARA_REVIEW_PLUGIN_ID]: {
    dependencies: [PARA_CORE_PLUGIN_ID, PARA_TASKS_PLUGIN_ID, PARA_GOALS_PLUGIN_ID],
    load: () => import('./builtins/paraReviewPlugin'),
  },
  [PARA_DASHBOARD_PLUGIN_ID]: {
    dependencies: [PARA_CORE_PLUGIN_ID, PARA_TASKS_PLUGIN_ID, PARA_GOALS_PLUGIN_ID, PARA_REVIEW_PLUGIN_ID],
    load: () => import('./builtins/paraDashboardPlugin'),
  },
  [PARA_MIGRATION_PLUGIN_ID]: {
    dependencies: [PARA_CORE_PLUGIN_ID, PARA_TASKS_PLUGIN_ID, PARA_GOALS_PLUGIN_ID, NOTES_PLUGIN_ID],
    load: () => import('./builtins/paraMigrationPlugin'),
  },
  [MEAL_PLANNER_PLUGIN_ID]: {
    load: () => import('./builtins/mealPlannerPlugin'),
  },
  [WORKOUT_PLANNER_PLUGIN_ID]: {
    load: () => import('./builtins/workoutPlannerPlugin'),
  },
  [MEDIA_LIBRARY_PLUGIN_ID]: {
    load: () => import('./builtins/mediaLibraryPlugin'),
  },
  ...Object.fromEntries(FOUNDATION_TOOL_DEFINITIONS.map((definition) => [definition.pluginId, {
    dependencies: FOUNDATION_DEPENDENCIES[definition.pluginId],
    load: () => import('./builtins/foundationToolPlugins').then((module) => ({ default: module.foundationToolPlugin(definition.pluginId) })),
  } satisfies Runnable])),
  ...Object.fromEntries([DECISION_JOURNAL_PLUGIN_ID, SKILL_TREE_PLUGIN_ID].map((id) => [id, {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/learningPlugins').then((module) => ({ default: module.learningPlugin(id) })),
  } satisfies Runnable])),
  ...Object.fromEntries(SELF_HOSTED_TOOL_DEFINITIONS.map((definition) => [definition.pluginId, {
    dependencies: SELF_HOSTED_DEPENDENCIES[definition.pluginId],
    load: () => import('./builtins/selfHostedToolPlugins').then((module) => ({ default: module.selfHostedToolPlugin(definition.pluginId) })),
  } satisfies Runnable])),
  ...Object.fromEntries(MEDIA_TYPE_PLUGIN_DEFINITIONS.map((definition, index) => [definition.pluginId, {
    dependencies: [MEDIA_LIBRARY_PLUGIN_ID],
    load: () => import('./builtins/mediaTypePlugins').then((module) => ({ default: module.mediaTypePlugin(definition, 141 + index) })),
  } satisfies Runnable])),
  [EDUCATION_CORE_PLUGIN_ID]: {
    load: () => import('./builtins/educationCorePlugin'),
  },
  [EDUCATION_CURRICULUM_PLUGIN_ID]: {
    dependencies: [EDUCATION_CORE_PLUGIN_ID],
    load: () => import('./builtins/educationCurriculumPlugin'),
  },
  [EDUCATION_STUDY_PLUGIN_ID]: {
    dependencies: [EDUCATION_CORE_PLUGIN_ID],
    load: () => import('./builtins/educationStudyPlugin'),
  },
  [EDUCATION_ASSIGNMENTS_PLUGIN_ID]: {
    dependencies: [EDUCATION_CORE_PLUGIN_ID],
    load: () => import('./builtins/educationAssignmentsPlugin'),
  },
  [EDUCATION_DASHBOARD_PLUGIN_ID]: {
    dependencies: [EDUCATION_CORE_PLUGIN_ID, EDUCATION_CURRICULUM_PLUGIN_ID, EDUCATION_STUDY_PLUGIN_ID, EDUCATION_ASSIGNMENTS_PLUGIN_ID],
    load: () => import('./builtins/educationDashboardPlugin'),
  },
  [INFORMATION_INTAKE_PLUGIN_ID]: {
    dependencies: [PARA_CORE_PLUGIN_ID],
    load: () => import('./builtins/informationIntakePlugin'),
  },
  [INFORMATION_WORKBENCH_PLUGIN_ID]: {
    dependencies: [INFORMATION_INTAKE_PLUGIN_ID],
    load: () => import('./builtins/informationWorkbenchPlugin'),
  },
  [INFORMATION_OUTPUTS_PLUGIN_ID]: {
    dependencies: [INFORMATION_INTAKE_PLUGIN_ID, NOTES_PLUGIN_ID],
    load: () => import('./builtins/informationOutputsPlugin'),
  },
  [INFORMATION_DASHBOARD_PLUGIN_ID]: {
    dependencies: [INFORMATION_INTAKE_PLUGIN_ID, INFORMATION_WORKBENCH_PLUGIN_ID, INFORMATION_OUTPUTS_PLUGIN_ID, RESEARCH_WORKFLOW_ENGINE_PLUGIN_ID],
    load: async () => ({ default: { activate() {} } }),
  },
  [RESEARCH_WORKFLOW_ENGINE_PLUGIN_ID]: {
    dependencies: ['daily-briefing', ...RESEARCH_ROLE_IDS, INFORMATION_INTAKE_PLUGIN_ID, INFORMATION_WORKBENCH_PLUGIN_ID, INFORMATION_OUTPUTS_PLUGIN_ID],
    load: async () => ({ default: { activate() {} } }),
  },
};

for (const role of RESEARCH_ROLES) {
  RUNNABLE[role.id] = {
    dependencies: [INFORMATION_INTAKE_PLUGIN_ID, INFORMATION_OUTPUTS_PLUGIN_ID],
    load: () => import('./builtins/researchRolePlugin').then(module => ({ default: module.researchRolePlugin(role.id) })),
  };
}

export const CATALOG: PluginManifest[] = PLUGINS.map((p) => {
  const runnable = RUNNABLE[p.id];
  return {
    id: p.id,
    name: p.name,
    description: p.desc,
    category: p.category,
    icon: p.icon,
    dependencies: runnable?.dependencies,
    builtin: runnable?.builtin,
    load: runnable?.load,
  };
});

// Internal state-only companion: installable as a dependency but intentionally
// absent from Marketplace so users see one coherent Paperless integration.
CATALOG.push({
  id: PAPERLESS_ACTIONS_PLUGIN_ID,
  name: 'Paperless write-back queue',
  description: 'Private state namespace for approved Paperless metadata actions.',
  category: 'integration',
  icon: PLUGINS.find(plugin => plugin.id === PAPERLESS_PLUGIN_ID)!.icon,
  load: RUNNABLE[PAPERLESS_ACTIONS_PLUGIN_ID].load,
});

// Existing installations expand into the replacement tools on startup. These
// compatibility entries are intentionally absent from marketplace metadata.
for (const id of [RESEARCH_WORKFLOW_ENGINE_PLUGIN_ID, INFORMATION_DASHBOARD_PLUGIN_ID]) {
  CATALOG.push({ id, name: 'Legacy research installation', description: 'Preserves existing installations while enabling individual knowledge tools.', category: 'research', icon: RESEARCH_ROLES[0].icon, ...RUNNABLE[id] });
}

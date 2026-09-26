import {
  BadgeDollarSign, BookOpenCheck, BriefcaseBusiness, Car, FilePenLine, FileSearch, GraduationCap,
  Landmark, Library, NotebookTabs, Radar, ScrollText, Send, ShieldCheck, ShieldEllipsis, Siren,
  TrendingUp, UserRoundSearch, WalletCards, Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { LifePluginConfig } from './lifeConfigs';

export const SECURITY_INVENTORY_CONFIG: LifePluginConfig = {
  id: 'security-inventory', title: 'Security Inventory', singular: 'security asset', description: 'Metadata for accounts, devices, public wallets, and identities. Never credentials or recovery secrets.', icon: ShieldCheck,
  statuses: ['Active', 'Review due', 'At risk', 'Retired'], categories: ['Account', 'Device', 'Wallet', 'Identity'], schedule: true, dateLabel: 'Next review', checklistLabel: 'Security controls', logLabel: 'Verification history', completedStatuses: ['Retired'], calendarSource: 'Security', securityMetadataOnly: true,
  fields: [{ key: 'provider', label: 'Provider or platform', type: 'text' }, { key: 'publicIdentifier', label: 'Public identifier or address', type: 'text' }, { key: 'authMethod', label: 'Authentication method', type: 'select', options: ['Passkey', 'Hardware key', 'Authenticator', 'External password manager', 'Other'] }, { key: 'custody', label: 'Custody or owner', type: 'text' }, { key: 'recoveryLocation', label: 'Recovery material location reference', type: 'text', placeholder: 'Reference only — never the secret' }, { key: 'lastPatched', label: 'Last patched', type: 'date' }],
};
export const SECURITY_RESILIENCE_CONFIG: LifePluginConfig = {
  id: 'security-resilience', title: 'Keys, Backups & Recovery', singular: 'resilience check', description: 'Rotation reminders, backup verification, recovery exercises, and emergency-access checks.', icon: ShieldEllipsis,
  statuses: ['Planned', 'Due', 'Verified', 'Failed', 'Retired'], categories: ['Key rotation', 'Backup verification', 'Recovery test', 'Emergency access'], schedule: true, dateLabel: 'Next check', checklistLabel: 'Safe procedure', logLabel: 'Verification results', completedStatuses: ['Verified', 'Retired'], calendarSource: 'Security', securityMetadataOnly: true,
  fields: [{ key: 'targetReference', label: 'Account, device, or wallet reference', type: 'text' }, { key: 'storageSystem', label: 'External storage system', type: 'text' }, { key: 'lastVerified', label: 'Last verified', type: 'date' }, { key: 'evidenceReference', label: 'Evidence reference', type: 'text' }, { key: 'result', label: 'Last result', type: 'select', options: ['Pass', 'Partial', 'Fail', 'Not run'] }],
};
export const SECURITY_INCIDENTS_CONFIG: LifePluginConfig = {
  id: 'security-incidents', title: 'Incidents & Procedures', singular: 'incident item', description: 'Incident records, response procedures, exercises, trusted contacts, and follow-up actions.', icon: Siren,
  statuses: ['Ready', 'Open', 'Contained', 'Recovering', 'Closed'], categories: ['Incident', 'Procedure', 'Exercise', 'Trusted contact'], schedule: true, dateLabel: 'Review or action date', checklistLabel: 'Response steps', logLabel: 'Incident timeline', completedStatuses: ['Closed'], calendarSource: 'Security', securityMetadataOnly: true,
  fields: [{ key: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] }, { key: 'systems', label: 'Affected system references', type: 'text' }, { key: 'procedureUrl', label: 'Procedure URL', type: 'url' }, { key: 'evidenceLocation', label: 'Evidence location reference', type: 'text' }],
};

export const WEALTH_BALANCE_CONFIG: LifePluginConfig = {
  id: 'wealth-balance-sheet', title: 'Accounts, Assets & Liabilities', singular: 'balance-sheet item', description: 'Provider-neutral balance-sheet snapshots without banking credentials.', icon: Landmark,
  statuses: ['Active', 'Review due', 'Closed'], categories: ['Cash account', 'Asset', 'Liability', 'Receivable'], amountLabel: 'Current value', schedule: true, dateLabel: 'Valuation date', logLabel: 'Value history', completedStatuses: ['Closed'], calendarSource: 'Wealth',
  fields: [{ key: 'institution', label: 'Institution', type: 'text' }, { key: 'accountSuffix', label: 'Account reference or last four', type: 'text' }, { key: 'currency', label: 'Currency', type: 'text', placeholder: 'EUR' }, { key: 'liquidity', label: 'Liquidity', type: 'select', options: ['Immediate', 'Short term', 'Long term', 'Restricted'] }, { key: 'ownership', label: 'Ownership', type: 'text' }],
};
export const WEALTH_CASHFLOW_CONFIG: LifePluginConfig = {
  id: 'wealth-cashflow', title: 'Cash Flow & Savings', singular: 'cash-flow item', description: 'Recurring income, expenses, transfers, budgets, and savings contributions.', icon: BadgeDollarSign,
  statuses: ['Expected', 'Due', 'Cleared', 'Paused', 'Cancelled'], categories: ['Income', 'Expense', 'Transfer', 'Budget', 'Savings contribution'], amountLabel: 'Amount', schedule: true, dateLabel: 'Next occurrence', checklistLabel: 'Processing checklist', logLabel: 'Transactions', completedStatuses: ['Cleared', 'Cancelled'], calendarSource: 'Wealth',
  fields: [{ key: 'currency', label: 'Currency', type: 'text', placeholder: 'EUR' }, { key: 'sourceAccount', label: 'Source account reference', type: 'text' }, { key: 'destinationAccount', label: 'Destination account reference', type: 'text' }, { key: 'counterparty', label: 'Counterparty', type: 'text' }],
};
export const WEALTH_INVESTMENTS_CONFIG: LifePluginConfig = {
  id: 'wealth-investments-goals', title: 'Investments & Goals', singular: 'investment or goal', description: 'Holdings, portfolios, savings goals, retirement targets, allocation notes, and snapshots.', icon: TrendingUp,
  statuses: ['Active', 'Target met', 'Review due', 'Exited'], categories: ['Holding', 'Portfolio', 'Savings goal', 'Retirement goal'], amountLabel: 'Current value or target', schedule: true, dateLabel: 'Review date', checklistLabel: 'Review checklist', logLabel: 'Snapshots & decisions', completedStatuses: ['Target met', 'Exited'], calendarSource: 'Wealth',
  fields: [{ key: 'tickerOrReference', label: 'Ticker or reference', type: 'text' }, { key: 'currency', label: 'Currency', type: 'text', placeholder: 'EUR' }, { key: 'quantity', label: 'Quantity', type: 'number' }, { key: 'costBasis', label: 'Cost basis', type: 'number' }, { key: 'targetAllocation', label: 'Target allocation %', type: 'number' }, { key: 'thesis', label: 'Thesis or goal definition', type: 'textarea' }],
};

export const EVIDENCE_LIBRARY_CONFIG: LifePluginConfig = {
  id: 'evidence-library', title: 'Sources & Bibliography', singular: 'source', description: 'Papers, books, web sources, datasets, quotations, citation data, and stable locators.', icon: Library,
  statuses: ['Inbox', 'Reading', 'Extracted', 'Cited', 'Archived'], categories: ['Paper', 'Book', 'Web', 'Dataset', 'Quotation'], ratingLabel: 'Source quality', checklistLabel: 'Extraction checklist', logLabel: 'Reading notes', completedStatuses: ['Cited', 'Archived'], calendarSource: 'Evidence',
  fields: [{ key: 'authors', label: 'Authors', type: 'text' }, { key: 'publicationDate', label: 'Publication date', type: 'date' }, { key: 'url', label: 'URL', type: 'url' }, { key: 'doi', label: 'DOI or stable identifier', type: 'text' }, { key: 'citationKey', label: 'Citation key', type: 'text' }, { key: 'locator', label: 'Page, section, or timestamp', type: 'text' }, { key: 'quotation', label: 'Quotation or extract', type: 'textarea' }],
};
export const EVIDENCE_CLAIMS_CONFIG: LifePluginConfig = {
  id: 'evidence-claims', title: 'Claims & Evidence Map', singular: 'claim', description: 'Claims, supporting and opposing evidence, confidence, dependencies, and synthesis.', icon: FileSearch,
  statuses: ['Draft', 'Supported', 'Contested', 'Refuted', 'Accepted'], categories: ['Claim', 'Supporting evidence', 'Counterevidence', 'Synthesis'], checklistLabel: 'Validation questions', logLabel: 'Reasoning history', completedStatuses: ['Accepted', 'Refuted'], calendarSource: 'Evidence',
  fields: [{ key: 'sourceIds', label: 'Source IDs', type: 'text' }, { key: 'relatedClaimIds', label: 'Related claim IDs', type: 'text' }, { key: 'relation', label: 'Relationship', type: 'select', options: ['Supports', 'Contradicts', 'Qualifies', 'Depends on', 'Replicates'] }, { key: 'confidence', label: 'Confidence', type: 'select', options: ['Low', 'Medium', 'High'] }, { key: 'scope', label: 'Scope and conditions', type: 'textarea' }],
};
export const EVIDENCE_REPRO_CONFIG: LifePluginConfig = {
  id: 'evidence-reproducibility', title: 'Reproducibility Records', singular: 'reproducibility record', description: 'Procedures, environments, datasets, runs, commits, outputs, and replication results.', icon: Radar,
  statuses: ['Planned', 'Running', 'Reproduced', 'Partial', 'Failed', 'Archived'], categories: ['Procedure', 'Environment', 'Dataset', 'Run', 'Artifact'], schedule: true, dateLabel: 'Run or review date', checklistLabel: 'Reproduction steps', logLabel: 'Run history', completedStatuses: ['Reproduced', 'Archived'], calendarSource: 'Evidence',
  fields: [{ key: 'sourceIds', label: 'Source or claim IDs', type: 'text' }, { key: 'repository', label: 'Repository URL', type: 'url' }, { key: 'commit', label: 'Commit or version', type: 'text' }, { key: 'environment', label: 'Environment', type: 'textarea' }, { key: 'dataset', label: 'Dataset reference', type: 'text' }, { key: 'result', label: 'Result summary', type: 'textarea' }],
};

export const CAREER_PORTFOLIO_CONFIG: LifePluginConfig = {
  id: 'career-portfolio', title: 'Roles, CVs & Accomplishments', singular: 'career record', description: 'Roles, CV variants, accomplishments, portfolio evidence, and impact statements.', icon: BriefcaseBusiness,
  statuses: ['Current', 'Draft', 'Ready', 'Past', 'Archived'], categories: ['Role', 'CV variant', 'Accomplishment', 'Portfolio item'], checklistLabel: 'Evidence checklist', logLabel: 'Revision history', completedStatuses: ['Past', 'Archived'], calendarSource: 'Career',
  fields: [{ key: 'organization', label: 'Organization', type: 'text' }, { key: 'startedOn', label: 'Started', type: 'date' }, { key: 'endedOn', label: 'Ended', type: 'date' }, { key: 'impact', label: 'Measured impact', type: 'textarea' }, { key: 'evidenceUrl', label: 'Evidence or portfolio URL', type: 'url' }],
};
export const CAREER_OPPORTUNITIES_CONFIG: LifePluginConfig = {
  id: 'career-opportunities', title: 'Applications & Interviews', singular: 'opportunity', description: 'Target roles, applications, interview stages, offers, contacts, and follow-ups.', icon: UserRoundSearch,
  statuses: ['Interested', 'Preparing', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn'], categories: ['Role', 'Application', 'Interview', 'Offer', 'Contact'], schedule: true, dateLabel: 'Next action', checklistLabel: 'Application checklist', logLabel: 'Interaction timeline', completedStatuses: ['Offer', 'Rejected', 'Withdrawn'], calendarSource: 'Career',
  fields: [{ key: 'organization', label: 'Organization', type: 'text' }, { key: 'jobUrl', label: 'Role URL', type: 'url' }, { key: 'contact', label: 'Contact', type: 'text' }, { key: 'salaryRange', label: 'Compensation range', type: 'text' }, { key: 'cvVariant', label: 'CV variant reference', type: 'text' }],
};
export const CAREER_DEVELOPMENT_CONFIG: LifePluginConfig = {
  id: 'career-development', title: 'Professional Development', singular: 'development item', description: 'Skills, certifications, learning goals, mentorship, and deliberate career experiments.', icon: GraduationCap,
  statuses: ['Planned', 'Active', 'Blocked', 'Completed', 'Maintaining'], categories: ['Skill', 'Certification', 'Goal', 'Mentorship', 'Experiment'], schedule: true, dateLabel: 'Next session or deadline', checklistLabel: 'Milestones', logLabel: 'Progress log', completedStatuses: ['Completed'], calendarSource: 'Career',
  fields: [{ key: 'targetLevel', label: 'Target level or outcome', type: 'text' }, { key: 'mentor', label: 'Mentor or reviewer', type: 'text' }, { key: 'credentialUrl', label: 'Credential URL', type: 'url' }, { key: 'evidence', label: 'Evidence of competence', type: 'textarea' }],
};

export const WRITING_MANUSCRIPTS_CONFIG: LifePluginConfig = {
  id: 'writing-manuscripts', title: 'Manuscripts', singular: 'manuscript', description: 'Books, essays, articles, stories, scripts, and other long-lived writing projects.', icon: FilePenLine,
  statuses: ['Idea', 'Drafting', 'Revising', 'Ready', 'Published', 'Shelved'], categories: ['Book', 'Essay', 'Article', 'Story', 'Script', 'Newsletter'], schedule: true, dateLabel: 'Next writing session', checklistLabel: 'Milestones', logLabel: 'Draft history', completedStatuses: ['Published', 'Shelved'], calendarSource: 'Writing',
  fields: [{ key: 'audience', label: 'Audience', type: 'text' }, { key: 'premise', label: 'Premise', type: 'textarea' }, { key: 'wordCount', label: 'Word count', type: 'number' }, { key: 'targetWords', label: 'Target words', type: 'number' }, { key: 'draftUrl', label: 'Draft URL', type: 'url' }],
};
export const WRITING_EDITORIAL_CONFIG: LifePluginConfig = {
  id: 'writing-editorial', title: 'Editorial Workflow', singular: 'editorial item', description: 'Draft versions, structural edits, copy edits, feedback rounds, and approval gates.', icon: NotebookTabs,
  statuses: ['Queued', 'In progress', 'Waiting for feedback', 'Changes requested', 'Approved'], categories: ['Draft', 'Structural edit', 'Copy edit', 'Fact check', 'Feedback'], schedule: true, dateLabel: 'Due or review date', checklistLabel: 'Editorial checklist', logLabel: 'Revision log', completedStatuses: ['Approved'], calendarSource: 'Writing',
  fields: [{ key: 'manuscriptId', label: 'Manuscript ID', type: 'text' }, { key: 'version', label: 'Version', type: 'text' }, { key: 'editor', label: 'Editor or reviewer', type: 'text' }, { key: 'feedbackUrl', label: 'Feedback URL', type: 'url' }],
};
export const WRITING_PUBLISHING_CONFIG: LifePluginConfig = {
  id: 'writing-publishing', title: 'Submissions & Publishing', singular: 'publishing item', description: 'Pitches, submissions, publications, rights, releases, and post-publication records.', icon: Send,
  statuses: ['Target', 'Preparing', 'Submitted', 'Accepted', 'Published', 'Rejected', 'Withdrawn'], categories: ['Pitch', 'Submission', 'Publication', 'Rights', 'Release'], schedule: true, dateLabel: 'Deadline or follow-up', amountLabel: 'Fee or payment', checklistLabel: 'Submission checklist', logLabel: 'Submission history', completedStatuses: ['Published', 'Rejected', 'Withdrawn'], calendarSource: 'Writing',
  fields: [{ key: 'manuscriptId', label: 'Manuscript ID', type: 'text' }, { key: 'publication', label: 'Publication or platform', type: 'text' }, { key: 'guidelinesUrl', label: 'Guidelines URL', type: 'url' }, { key: 'rights', label: 'Rights and license', type: 'textarea' }, { key: 'publicationUrl', label: 'Published URL', type: 'url' }],
};

export const MOBILITY_VEHICLES_CONFIG: LifePluginConfig = {
  id: 'mobility-vehicles', title: 'Vehicles', singular: 'vehicle', description: 'Cars, bicycles, motorcycles, shared vehicles, specifications, ownership, and condition.', icon: Car,
  statuses: ['Active', 'Maintenance', 'Stored', 'Sold'], categories: ['Car', 'Bicycle', 'Motorcycle', 'Scooter', 'Shared vehicle', 'Other'], amountLabel: 'Current or insured value', checklistLabel: 'Equipment & condition', logLabel: 'Ownership history', completedStatuses: ['Sold'], calendarSource: 'Mobility',
  fields: [{ key: 'makeModel', label: 'Make and model', type: 'text' }, { key: 'year', label: 'Year', type: 'number' }, { key: 'registration', label: 'Registration reference', type: 'text' }, { key: 'vinOrSerial', label: 'VIN or serial', type: 'text' }, { key: 'storage', label: 'Storage location', type: 'text' }],
};
export const MOBILITY_OPERATIONS_CONFIG: LifePluginConfig = {
  id: 'mobility-operations', title: 'Mileage & Maintenance', singular: 'mobility operation', description: 'Mileage, inspections, service, repairs, fuel, charging, and recurring maintenance.', icon: Wrench,
  statuses: ['Planned', 'Due', 'Completed', 'Deferred'], categories: ['Mileage', 'Maintenance', 'Inspection', 'Repair', 'Fuel', 'Charging'], schedule: true, dateLabel: 'Date or next due', amountLabel: 'Cost', checklistLabel: 'Service checklist', logLabel: 'Service & mileage history', completedStatuses: ['Completed'], calendarSource: 'Mobility',
  fields: [{ key: 'vehicleId', label: 'Vehicle ID', type: 'text' }, { key: 'odometer', label: 'Odometer or distance', type: 'number' }, { key: 'distanceUnit', label: 'Distance unit', type: 'select', options: ['km', 'mi'] }, { key: 'provider', label: 'Provider', type: 'text' }, { key: 'receiptUrl', label: 'Receipt URL', type: 'url' }],
};
export const MOBILITY_DOCUMENTS_CONFIG: LifePluginConfig = {
  id: 'mobility-documents', title: 'Permits & Transport Passes', singular: 'mobility document', description: 'Licenses, registration, insurance, permits, toll products, and public-transport passes.', icon: WalletCards,
  statuses: ['Valid', 'Renewal due', 'Expired', 'Cancelled'], categories: ['License', 'Registration', 'Insurance', 'Permit', 'Transport pass', 'Toll'], schedule: true, dateLabel: 'Expires or renews', checklistLabel: 'Renewal checklist', logLabel: 'Renewal history', completedStatuses: ['Cancelled'], calendarSource: 'Mobility',
  fields: [{ key: 'holder', label: 'Holder', type: 'text' }, { key: 'vehicleId', label: 'Vehicle ID', type: 'text' }, { key: 'issuer', label: 'Issuer', type: 'text' }, { key: 'reference', label: 'Document reference', type: 'text' }, { key: 'documentUrl', label: 'Document URL', type: 'url' }],
};

export const DOMAIN_COLLECTION_CONFIGS = [
  SECURITY_INVENTORY_CONFIG, SECURITY_RESILIENCE_CONFIG, SECURITY_INCIDENTS_CONFIG,
  WEALTH_BALANCE_CONFIG, WEALTH_CASHFLOW_CONFIG, WEALTH_INVESTMENTS_CONFIG,
  EVIDENCE_LIBRARY_CONFIG, EVIDENCE_CLAIMS_CONFIG, EVIDENCE_REPRO_CONFIG,
  CAREER_PORTFOLIO_CONFIG, CAREER_OPPORTUNITIES_CONFIG, CAREER_DEVELOPMENT_CONFIG,
  WRITING_MANUSCRIPTS_CONFIG, WRITING_EDITORIAL_CONFIG, WRITING_PUBLISHING_CONFIG,
  MOBILITY_VEHICLES_CONFIG, MOBILITY_OPERATIONS_CONFIG, MOBILITY_DOCUMENTS_CONFIG,
] as const;

export interface DomainDefinition { id: string; title: string; description: string; icon: LucideIcon; configIds: string[]; }
export const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  { id: 'security', title: 'Digital Security & Identity', description: 'Security posture metadata, recovery readiness, and incident procedures—never secret material.', icon: ShieldCheck, configIds: ['security-inventory', 'security-resilience', 'security-incidents'] },
  { id: 'wealth', title: 'Personal Finance & Wealth', description: 'Balance sheet, cash flow, investments, goals, and provider-neutral financial snapshots.', icon: Landmark, configIds: ['wealth-balance-sheet', 'wealth-cashflow', 'wealth-investments-goals'] },
  { id: 'evidence', title: 'Research Evidence Lab', description: 'Sources, claims, evidence relationships, bibliographies, and reproducibility.', icon: BookOpenCheck, configIds: ['evidence-library', 'evidence-claims', 'evidence-reproducibility'] },
  { id: 'career', title: 'Career Studio', description: 'Roles, applications, CVs, interviews, accomplishments, and development.', icon: BriefcaseBusiness, configIds: ['career-portfolio', 'career-opportunities', 'career-development'] },
  { id: 'writing', title: 'Writing & Publishing Studio', description: 'Manuscripts, editorial stages, submissions, releases, and publication history.', icon: ScrollText, configIds: ['writing-manuscripts', 'writing-editorial', 'writing-publishing'] },
  { id: 'mobility', title: 'Travel & Mobility', description: 'Trips, vehicles, mileage, maintenance, permits, and transport passes.', icon: Car, configIds: ['mobility-vehicles', 'mobility-operations', 'mobility-documents'] },
];

export const domainConfig = (id: string): LifePluginConfig | undefined => DOMAIN_COLLECTION_CONFIGS.find((config) => config.id === id);
export const domainDefinition = (id: string): DomainDefinition | undefined => DOMAIN_DEFINITIONS.find((domain) => domain.id === id);

import {
  BellRing,
  BookMarked,
  BookOpenCheck,
  Brain,
  FileArchive,
  GraduationCap,
  Images,
  ListOrdered,
  Quote,
  GitBranch,
  NotebookPen,
  Star,
  type LucideIcon,
} from 'lucide-react';
import type { LifePluginConfig } from './lifeConfigs';

export const METADATA_RESOLVER_PLUGIN_ID = 'metadata-artwork-resolver';
export const MEDIA_DIARY_PLUGIN_ID = 'media-diary-reviews';
export const LISTS_RANKINGS_PLUGIN_ID = 'lists-rankings';
export const UNIVERSAL_ATTACHMENTS_PLUGIN_ID = 'universal-attachments';
export const REMINDERS_PLUGIN_ID = 'reminders-notifications';
export const READING_ANNOTATIONS_PLUGIN_ID = 'reading-annotations';
export const FLASHCARDS_PLUGIN_ID = 'flashcards-spaced-repetition';
export const LEARNING_GOALS_PLUGIN_ID = 'learning-goals';
export const READ_LATER_PLUGIN_ID = 'bookmark-read-later';
export const CITATION_MANAGER_PLUGIN_ID = 'citation-manager';
export const DECISION_JOURNAL_PLUGIN_ID = 'decision-journal';
export const SKILL_TREE_PLUGIN_ID = 'skill-tree';

export interface FoundationToolDefinition {
  pluginId: string;
  label: string;
  description: string;
  category: string;
  subcategory: string;
  mode: string;
  section: string;
  order: number;
  icon: LucideIcon;
  config: LifePluginConfig;
}

const tool = (
  pluginId: string,
  label: string,
  description: string,
  category: string,
  subcategory: string,
  mode: string,
  section: string,
  order: number,
  config: Omit<LifePluginConfig, 'id' | 'title' | 'description' | 'icon'>,
  icon: LucideIcon,
): FoundationToolDefinition => ({
  pluginId, label, description, category, subcategory, mode, section, order, icon,
  config: { ...config, id: pluginId, title: label, description, icon },
});

export const FOUNDATION_TOOL_DEFINITIONS: readonly FoundationToolDefinition[] = [
  tool(DECISION_JOURNAL_PLUGIN_ID, 'Decision Journal', 'Record choices, alternatives, assumptions, and predictions; revisit the outcome on a scheduled review date.', 'productivity', 'Reflection', 'productivity', 'Planning', 76, {
    singular: 'decision', statuses: ['Pending review', 'Reviewed', 'Archived'], categories: ['Personal', 'Career', 'Project', 'Learning'], completedStatuses: ['Reviewed', 'Archived'], calendarSource: 'Reflection', schedule: true, dateLabel: 'Review date', logLabel: 'Outcome reviews',
    fields: [
      { key: 'choice', label: 'Chosen option', type: 'textarea' },
      { key: 'alternatives', label: 'Alternatives', type: 'textarea' },
      { key: 'assumptions', label: 'Assumptions', type: 'textarea' },
      { key: 'expectedOutcome', label: 'Expected outcome', type: 'textarea' },
      { key: 'confidence', label: 'Confidence (%)', type: 'number' },
      { key: 'actualOutcome', label: 'Actual outcome', type: 'textarea' },
      { key: 'lessons', label: 'Lessons learned', type: 'textarea' },
    ],
  }, NotebookPen),
  tool(SKILL_TREE_PLUGIN_ID, 'Skill Tree', 'Connect skills and prerequisites across education, career, and hobbies; record practice and evidence of mastery.', 'education', 'Practice', 'education', 'Education', 58, {
    singular: 'skill', statuses: ['Planned', 'Practicing', 'Mastered', 'Paused'], categories: ['Education', 'Career', 'Hobby'], completedStatuses: ['Mastered', 'Paused'], calendarSource: 'Evidence', schedule: true, dateLabel: 'Target date', logLabel: 'Practice history',
    fields: [
      { key: 'targetEvidence', label: 'Mastery criteria', type: 'textarea' },
      { key: 'practicePlan', label: 'Practice plan', type: 'textarea' },
      { key: 'evidence', label: 'Evidence of mastery', type: 'textarea' },
      { key: 'learningGoalId', label: 'Learning goal', type: 'life', sourcePluginId: LEARNING_GOALS_PLUGIN_ID },
    ],
  }, GitBranch),
  tool(METADATA_RESOLVER_PLUGIN_ID, 'Metadata & Artwork Resolver', 'Keep provider matches, external IDs, canonical metadata, and artwork candidates together before applying them to media.', 'media', 'Library', 'media', 'Library', 110, {
    singular: 'match', statuses: ['Queued', 'Needs input', 'Matched', 'Applied', 'Rejected'], categories: ['Open Library', 'TMDB', 'MusicBrainz', 'YouTube', 'IGDB', 'Manual'], completedStatuses: ['Applied', 'Rejected'], calendarSource: 'Inventory', checklistLabel: 'Fields to apply', logLabel: 'Resolution history',
    fields: [
      { key: 'query', label: 'Search query', type: 'text' },
      { key: 'externalId', label: 'External ID', type: 'text' },
      { key: 'sourceUrl', label: 'Source URL', type: 'url' },
      { key: 'artworkUrl', label: 'Artwork URL', type: 'url' },
      { key: 'matchedTitle', label: 'Matched title', type: 'text' },
      { key: 'creatorYear', label: 'Creator and year', type: 'text' },
    ],
  }, Images),
  tool(MEDIA_DIARY_PLUGIN_ID, 'Media Diary & Reviews', 'Log when you watched, read, listened, or played; keep ratings, reviews, and repeat experiences in one diary.', 'media', 'Library', 'media', 'Library', 90, {
    singular: 'diary entry', statuses: ['Draft', 'Logged', 'Revisit', 'Archived'], categories: ['Written', 'Seen', 'Watched', 'Listened', 'Spoken', 'Played', 'Live'], completedStatuses: ['Logged', 'Archived'], calendarSource: 'Reflection', schedule: true, dateLabel: 'Consumed on', ratingLabel: 'Rating', logLabel: 'Repeat experiences',
    fields: [
      { key: 'mediaTitle', label: 'Media title', type: 'text' },
      { key: 'mediaId', label: 'Media item', type: 'media' },
      { key: 'progress', label: 'Progress or edition', type: 'text' },
      { key: 'reviewUrl', label: 'Published review URL', type: 'url' },
      { key: 'review', label: 'Review', type: 'textarea' },
    ],
  }, Star),
  tool(LISTS_RANKINGS_PLUGIN_ID, 'Lists & Rankings', 'Build ordered lists, rankings, tier lists, and year-end selections across every media format.', 'media', 'Library', 'media', 'Library', 100, {
    singular: 'list', statuses: ['Draft', 'Active', 'Complete', 'Archived'], categories: ['List', 'Ranking', 'Tier list', 'Year-end list'], completedStatuses: ['Complete', 'Archived'], calendarSource: 'Inventory', checklistLabel: 'Entries', logLabel: 'Revisions',
    fields: [
      { key: 'theme', label: 'Theme or prompt', type: 'text' },
      { key: 'period', label: 'Period', type: 'text', placeholder: '2026, decade, season…' },
      { key: 'criteria', label: 'Ranking criteria', type: 'textarea' },
      { key: 'visibility', label: 'Visibility', type: 'select', options: ['Private', 'Shared', 'Public'] },
    ],
  }, ListOrdered),
  tool(UNIVERSAL_ATTACHMENTS_PLUGIN_ID, 'Universal Attachments', 'Index local files and remote assets with ownership, checksums, source locations, and record-level links.', 'productivity', 'Files', 'tools', 'Tools', 80, {
    singular: 'attachment', statuses: ['Available', 'Needs review', 'Missing', 'Archived'], categories: ['Image', 'Document', 'Audio', 'Video', 'Archive', 'Link', 'Other'], completedStatuses: ['Archived'], calendarSource: 'Inventory', logLabel: 'File history',
    fields: [
      { key: 'location', label: 'File path or URL', type: 'url' },
      { key: 'mimeType', label: 'MIME type', type: 'text' },
      { key: 'size', label: 'Size', type: 'text', placeholder: '2.4 MB' },
      { key: 'checksum', label: 'Checksum', type: 'text' },
      { key: 'ownerPlugin', label: 'Owning plugin', type: 'text' },
      { key: 'ownerRecord', label: 'Linked record ID', type: 'text' },
      { key: 'source', label: 'Source or license', type: 'textarea' },
    ],
  }, FileArchive),
  tool(REMINDERS_PLUGIN_ID, 'Reminders & Notifications', 'Create actionable reminders with due dates, lead times, delivery preferences, snoozing, and linked records.', 'productivity', 'Planning', 'productivity', 'Planning', 75, {
    singular: 'reminder', statuses: ['Scheduled', 'Snoozed', 'Due', 'Done', 'Dismissed'], categories: ['Task', 'Renewal', 'Release', 'Appointment', 'Maintenance', 'Follow-up'], completedStatuses: ['Done', 'Dismissed'], calendarSource: 'Follow-up', schedule: true, dateLabel: 'Due', checklistLabel: 'Steps', logLabel: 'Notification history',
    fields: [
      { key: 'message', label: 'Notification message', type: 'textarea' },
      { key: 'time', label: 'Delivery time', type: 'time' },
      { key: 'leadTime', label: 'Lead time', type: 'text', placeholder: '30 minutes, 2 days…' },
      { key: 'channel', label: 'Delivery', type: 'select', options: ['In app', 'System notification', 'No notification'] },
      { key: 'linkedPlugin', label: 'Linked plugin', type: 'text' },
      { key: 'linkedRecord', label: 'Linked record ID', type: 'text' },
    ],
  }, BellRing),
  tool(READING_ANNOTATIONS_PLUGIN_ID, 'Reading Annotations', 'Capture quotes, highlights, questions, and marginalia with precise locators and links back to the source.', 'education', 'Reading', 'knowledge', 'Reading & Capture', 55, {
    singular: 'annotation', statuses: ['Captured', 'Reviewed', 'Promoted', 'Archived'], categories: ['Highlight', 'Quote', 'Idea', 'Question', 'Vocabulary'], completedStatuses: ['Promoted', 'Archived'], calendarSource: 'Evidence', checklistLabel: 'Follow-up', logLabel: 'Revision history',
    fields: [
      { key: 'workTitle', label: 'Work title', type: 'text' },
      { key: 'mediaId', label: 'Media item', type: 'media' },
      { key: 'locator', label: 'Page, chapter, or timestamp', type: 'text' },
      { key: 'sourceUrl', label: 'Source URL', type: 'url' },
      { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
      { key: 'interpretation', label: 'Interpretation', type: 'textarea' },
      { key: 'citationId', label: 'Citation', type: 'life', sourcePluginId: CITATION_MANAGER_PLUGIN_ID },
    ],
  }, Quote),
  tool(FLASHCARDS_PLUGIN_ID, 'Flashcards & Spaced Repetition', 'Create deck-based prompts and schedule review dates with intervals, confidence, source links, and a durable review log.', 'education', 'Practice', 'education', 'Education', 56, {
    singular: 'flashcard', statuses: ['New', 'Learning', 'Review', 'Suspended'], categories: ['Concept', 'Definition', 'Language', 'Problem', 'Cloze'], completedStatuses: ['Suspended'], calendarSource: 'Evidence', schedule: true, dateLabel: 'Next review', logLabel: 'Review history',
    fields: [
      { key: 'deck', label: 'Deck', type: 'text' },
      { key: 'front', label: 'Front', type: 'textarea' },
      { key: 'back', label: 'Back', type: 'textarea' },
      { key: 'intervalDays', label: 'Interval in days', type: 'number' },
      { key: 'stability', label: 'FSRS stability', type: 'number' },
      { key: 'difficulty', label: 'FSRS difficulty', type: 'number' },
      { key: 'source', label: 'Source or annotation ID', type: 'text' },
      { key: 'learningGoalId', label: 'Learning goal', type: 'life', sourcePluginId: LEARNING_GOALS_PLUGIN_ID },
      { key: 'skillId', label: 'Skill', type: 'life', sourcePluginId: SKILL_TREE_PLUGIN_ID },
    ],
  }, Brain),
  tool(LEARNING_GOALS_PLUGIN_ID, 'Learning Goals', 'Define concrete learning outcomes, evidence of mastery, milestones, target dates, and links to courses or PARA.', 'education', 'Planning', 'education', 'Education', 57, {
    singular: 'learning goal', statuses: ['Planned', 'Active', 'Paused', 'Achieved', 'Dropped'], categories: ['Knowledge', 'Skill', 'Certification', 'Course', 'Reading'], completedStatuses: ['Achieved', 'Dropped'], calendarSource: 'Evidence', schedule: true, dateLabel: 'Target date', checklistLabel: 'Milestones', logLabel: 'Evidence and reflections',
    fields: [
      { key: 'outcome', label: 'Desired outcome', type: 'textarea' },
      { key: 'successMeasure', label: 'Evidence of mastery', type: 'textarea' },
      { key: 'courseId', label: 'Course or program', type: 'education' },
      { key: 'currentLevel', label: 'Current level', type: 'text' },
      { key: 'targetLevel', label: 'Target level', type: 'text' },
    ],
  }, GraduationCap),
  tool(READ_LATER_PLUGIN_ID, 'Bookmarks & Read Later', 'Triage articles, papers, videos, podcasts, and webpages into a deliberate queue with context for why each was saved.', 'education', 'Capture', 'knowledge', 'Reading & Capture', 58, {
    singular: 'bookmark', statuses: ['Inbox', 'Next', 'Reading', 'Done', 'Archived'], categories: ['Article', 'Newsletter', 'Video', 'Podcast', 'Paper', 'Web page'], completedStatuses: ['Done', 'Archived'], calendarSource: 'Evidence', checklistLabel: 'Takeaways', logLabel: 'Reading history',
    fields: [
      { key: 'url', label: 'URL', type: 'url' },
      { key: 'author', label: 'Author or source', type: 'text' },
      { key: 'estimate', label: 'Time estimate', type: 'text' },
      { key: 'whySaved', label: 'Why this is worth your time', type: 'textarea' },
      { key: 'mediaId', label: 'Media item', type: 'media' },
    ],
  }, BookMarked),
  tool(CITATION_MANAGER_PLUGIN_ID, 'Citation Manager', 'Manage identifiers, authorship, publication details, citation keys, verification, and formatted references.', 'education', 'Research', 'evidence', 'Evidence Lab', 59, {
    singular: 'citation', statuses: ['Inbox', 'Verified', 'Cited', 'Archived'], categories: ['Journal article', 'Book', 'Chapter', 'Web', 'Dataset', 'Report', 'Thesis'], completedStatuses: ['Cited', 'Archived'], calendarSource: 'Evidence', checklistLabel: 'Verification', logLabel: 'Citation usage',
    fields: [
      { key: 'authors', label: 'Authors', type: 'textarea' },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'container', label: 'Journal, publisher, or collection', type: 'text' },
      { key: 'doi', label: 'DOI', type: 'text' },
      { key: 'isbn', label: 'ISBN', type: 'text' },
      { key: 'url', label: 'Canonical URL', type: 'url' },
      { key: 'citationKey', label: 'Citation key', type: 'text' },
      { key: 'style', label: 'Citation style', type: 'select', options: ['APA', 'Harvard', 'Vancouver'] },
      { key: 'formatted', label: 'Formatted citation', type: 'textarea' },
      { key: 'cslJson', label: 'Zotero-compatible CSL JSON', type: 'textarea' },
    ],
  }, BookOpenCheck),
] as const;

export const FOUNDATION_PLUGIN_IDS = FOUNDATION_TOOL_DEFINITIONS.map((definition) => definition.pluginId);
export const HIGHEST_VALUE_FOUNDATION_PLUGIN_IDS = [METADATA_RESOLVER_PLUGIN_ID, MEDIA_DIARY_PLUGIN_ID, LISTS_RANKINGS_PLUGIN_ID, UNIVERSAL_ATTACHMENTS_PLUGIN_ID, REMINDERS_PLUGIN_ID] as const;
export const KNOWLEDGE_LEARNING_PLUGIN_IDS = [READING_ANNOTATIONS_PLUGIN_ID, FLASHCARDS_PLUGIN_ID, LEARNING_GOALS_PLUGIN_ID, READ_LATER_PLUGIN_ID, CITATION_MANAGER_PLUGIN_ID] as const;

export function foundationToolDefinition(id: string): FoundationToolDefinition | undefined {
  return FOUNDATION_TOOL_DEFINITIONS.find((definition) => definition.pluginId === id);
}

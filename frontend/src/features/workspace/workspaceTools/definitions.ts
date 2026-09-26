import { Archive, FolderKanban, FileText, FolderSync, History, Inbox, ListChecks, Newspaper } from 'lucide-react';

export const WORKSPACE_TOOLS = [
  { id: 'project-workspaces', name: 'Project Workspaces', desc: 'Bring project notes, tasks, decisions, runbooks and evidence together, and export the complete project as a capsule.', icon: FolderKanban },
  { id: 'executable-runbooks', name: 'Executable Runbooks', desc: 'Run note-based procedures with manual steps, Blueprint actions, approval gates and execution receipts.', icon: ListChecks },
  { id: 'universal-inbox', name: 'Universal Inbox', desc: 'Capture text, URLs, documents, images, email files and voice memos; review tags and properties before filing.', icon: Inbox },
  { id: 'workspace-time-machine', name: 'Workspace Time Machine', desc: 'Save named checkpoints, inspect note, link and plugin changes, and selectively restore earlier content.', icon: History },
  { id: 'local-folder-bridge', name: 'Local Folder Bridge', desc: 'Synchronize a chosen Markdown folder with notes, preview changes and resolve conflicts explicitly.', icon: FolderSync },
  { id: 'workspace-briefings', name: 'What Changed?', desc: 'Review changed notes, decisions, overdue tasks and failed workflows since your last briefing.', icon: Newspaper },
  { id: 'living-documents', name: 'Living Documents', desc: 'Compose notes with live saved queries and linked source excerpts that refresh as their records change.', icon: FileText },
  { id: 'workspace-capsules', name: 'Workspace Capsules', desc: 'Preview and export selected notes, links, attachments, property schemas and plugin requirements; import as a new project.', icon: Archive },
] as const;
export type WorkspaceToolId = typeof WORKSPACE_TOOLS[number]['id'];

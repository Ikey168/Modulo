import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecisionJournalView, SkillTreeView } from '../LearningPluginViews';
import { NoteFlashcardCapture } from '../NoteFlashcardCapture';
import { FlashcardReview } from '../FoundationToolView';
import { DECISION_JOURNAL_PLUGIN_ID, FLASHCARDS_PLUGIN_ID, SKILL_TREE_PLUGIN_ID, foundationToolDefinition } from '../foundationTools';
import { emptyLifeCollection, parseLifeCollection, type LifeCollectionData } from '../lifeStore';
import { LIFE_COLLECTION_SCHEMA } from '../useLifeCollection';
import { createMemoryWorkspace } from '../../../__tests__/helpers/memoryWorkspaceState';
import { flashcardFromNote, newLearningRecord } from '../learningTools';
import type { WorkspaceViewProps } from '../plugins/types';

const memory = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof createMemoryWorkspace> }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => memory.current.api }));
const settle = () => act(async () => { await memory.current.flush(); await new Promise((resolve) => setTimeout(resolve, 0)); });
const readLifeCollection = (id: string): LifeCollectionData => parseLifeCollection(memory.current.value('life-collections', id) ?? emptyLifeCollection());
const writeLifeCollection = (id: string, data: LifeCollectionData) => memory.current.seed('life-collections', id, data, LIFE_COLLECTION_SCHEMA);

const note = { id: 7, title: 'Memory', content: 'Retrieval strengthens memory.', tags: [] };
const workspace = (): WorkspaceViewProps => ({
  data: { notes: [note], links: [], tags: [], loading: false, error: null, refresh: vi.fn(), createNote: vi.fn(), updateNote: vi.fn(), deleteNote: vi.fn(), anchorNote: vi.fn(), addTag: vi.fn(), removeTag: vi.fn(), createLink: vi.fn(), removeLink: vi.fn() },
  selectedId: 7, setSelectedId: vi.fn(), editMode: false, setEditMode: vi.fn(), searchQuery: '', setSearchQuery: vi.fn(),
  onNewNote: vi.fn(), onOpenNote: vi.fn(), graphLinks: [], navigateView: vi.fn(),
  contributions: { views: [], notePanels: [], noteFences: [], editorActions: [], blueprintNodes: [] },
});

beforeEach(() => {
  localStorage.clear();
  memory.current = createMemoryWorkspace();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('learning plugin workflows', () => {
  it('creates, edits, and reviews a decision while preserving the original prediction', async () => {
    const user = userEvent.setup();
    render(<DecisionJournalView {...workspace()} />);
    await settle();
    await user.click(screen.getAllByRole('button', { name: 'New decision' })[0]);
    await user.type(screen.getByLabelText('Title'), 'Take the course');
    await user.type(screen.getByLabelText('Chosen option'), 'Evening class');
    await user.type(screen.getByLabelText('Expected outcome'), 'Finish in six weeks');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Open Take the course' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Evening course');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Open Evening course' }));
    await user.click(screen.getByRole('button', { name: 'Review outcome' }));
    await user.type(screen.getByLabelText('Actual outcome'), 'Finished in eight weeks');
    await user.type(screen.getByLabelText('Lessons learned'), 'Plan more practice');
    await user.click(screen.getByRole('button', { name: 'Complete review' }));
    await settle();
    expect(readLifeCollection(DECISION_JOURNAL_PLUGIN_ID).records[0]).toMatchObject({ title: 'Evening course', status: 'Reviewed', values: { expectedOutcome: 'Finish in six weeks', actualOutcome: 'Finished in eight weeks' } });
  });

  it('keeps the decision draft open when the server store cannot accept a save', async () => {
    memory.current.api.workspaceState = () => new Promise(() => {});
    const user = userEvent.setup();
    render(<DecisionJournalView {...workspace()} />);
    await settle();
    await user.click(screen.getAllByRole('button', { name: 'New decision' })[0]);
    await user.type(screen.getByLabelText('Title'), 'Choose A');
    await user.type(screen.getByLabelText('Chosen option'), 'A');
    await user.type(screen.getByLabelText('Expected outcome'), 'B');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not queue');
    expect(screen.getByLabelText('Title')).toHaveValue('Choose A');
    await settle();
    expect(readLifeCollection(DECISION_JOURNAL_PLUGIN_ID).records).toEqual([]);
  });

  it('creates a skill, logs practice, and confirms deletion before removing it', async () => {
    const user = userEvent.setup();
    render(<SkillTreeView {...workspace()} />);
    await settle();
    await user.click(screen.getAllByRole('button', { name: 'New skill' })[0]);
    await user.type(screen.getByLabelText('Skill name'), 'Guitar');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Open skill Guitar' }));
    await user.click(screen.getByRole('button', { name: 'Log practice' }));
    await user.type(screen.getByLabelText('Activity and observations'), 'Chord transitions');
    await user.click(screen.getByRole('button', { name: 'Save practice' }));
    await settle();
    expect(readLifeCollection(SKILL_TREE_PLUGIN_ID).records[0]).toMatchObject({ status: 'Practicing', values: { practiceMinutes: '30' } });
    await user.click(screen.getByRole('button', { name: 'Open skill Guitar' }));
    await user.click(screen.getByRole('button', { name: 'Delete skill Guitar' }));
    await settle();
    expect(readLifeCollection(SKILL_TREE_PLUGIN_ID).records).toHaveLength(1);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await settle();
    expect(readLifeCollection(SKILL_TREE_PLUGIN_ID).records).toEqual([]);
  });

  it('blocks deleting a prerequisite used by another skill', async () => {
    const basic = { ...newLearningRecord('Planned', 'Education'), id: 'basic', title: 'Basics' };
    const advanced = { ...newLearningRecord('Planned', 'Education'), id: 'advanced', title: 'Advanced', values: { prerequisites: '["basic"]' } };
    writeLifeCollection(SKILL_TREE_PLUGIN_ID, { ...emptyLifeCollection(), records: [basic, advanced] });
    const user = userEvent.setup();
    render(<SkillTreeView {...workspace()} />);
    await settle();
    await user.click(screen.getByRole('button', { name: 'Open skill Basics' }));
    await user.click(screen.getByRole('button', { name: 'Delete skill Basics' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('prerequisites');
    await settle();
    expect(readLifeCollection(SKILL_TREE_PLUGIN_ID).records).toHaveLength(2);
  });

  it('turns a selected note passage into a persisted, linked flashcard', async () => {
    const user = userEvent.setup();
    render(<NoteFlashcardCapture workspace={workspace()} />);
    await settle();
    await user.click(screen.getByRole('button', { name: 'Create from a note' }));
    const source = screen.getByLabelText('Source passage') as HTMLTextAreaElement;
    source.setSelectionRange(0, 9);
    await user.click(screen.getByRole('button', { name: 'Use selected passage' }));
    expect(screen.getByLabelText('Answer')).toHaveValue('Retrieval');
    await user.type(screen.getByLabelText('Question'), 'What strengthens memory?');
    await user.click(screen.getByRole('button', { name: 'Add flashcard' }));
    await settle();
    expect(readLifeCollection(FLASHCARDS_PLUGIN_ID).records[0].values).toMatchObject({ back: 'Retrieval', sourceNoteId: '7' });
    expect(screen.getByRole('status')).toHaveTextContent('Flashcard added');
  });

  it('reveals only the current card and preserves review progress across remounts', async () => {
    const cards = [flashcardFromNote(note, 'Question one', 'Answer one', 'Study'), flashcardFromNote(note, 'Question two', 'Answer two', 'Study')];
    writeLifeCollection(FLASHCARDS_PLUGIN_ID, { ...emptyLifeCollection(), records: cards });
    const props = workspace();
    const user = userEvent.setup();
    const view = render(<FlashcardReview definition={foundationToolDefinition(FLASHCARDS_PLUGIN_ID)!} workspace={props} />);
    await settle();
    expect(screen.queryByText('Answer one')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    expect(screen.getByText('Answer one')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open source: Memory' }));
    expect(props.onOpenNote).toHaveBeenCalledWith(7);
    await user.click(screen.getByRole('button', { name: 'Good' }));
    expect(screen.getByText('Question two')).toBeVisible();
    expect(screen.queryByText('Answer two')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText('All limit'), { code: 'Space' });
    expect(screen.queryByText('Answer two')).not.toBeInTheDocument();
    view.unmount();
    render(<FlashcardReview definition={foundationToolDefinition(FLASHCARDS_PLUGIN_ID)!} workspace={props} />);
    await settle();
    expect(screen.getByText('Question two')).toBeVisible();
    await settle();
    expect(readLifeCollection(FLASHCARDS_PLUGIN_ID).records[0].log).toHaveLength(1);
    act(() => { window.dispatchEvent(new Event('storage')); });
  });
});

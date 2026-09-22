import { useRef, useState } from 'react';
import { Button, Input, Textarea } from '@/ui';
import { FLASHCARDS_PLUGIN_ID, SKILL_TREE_PLUGIN_ID } from './foundationTools';
import { flashcardFromNote } from './learningTools';
import type { WorkspaceViewProps } from './plugins/types';
import { useLearningCollection } from './useLearningCollection';
import { Choice, Field } from './viewkit';

export function NoteFlashcardCapture({ workspace }: { workspace: WorkspaceViewProps }) {
  const { commit, error, setError } = useLearningCollection(FLASHCARDS_PLUGIN_ID);
  const { data: skills } = useLearningCollection(SKILL_TREE_PLUGIN_ID);
  const [open, setOpen] = useState(false);
  const [noteId, setNoteId] = useState(workspace.selectedId ? String(workspace.selectedId) : '');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [deck, setDeck] = useState('Notes');
  const [skillId, setSkillId] = useState('');
  const [saved, setSaved] = useState('');
  const passageRef = useRef<HTMLTextAreaElement>(null);
  const note = workspace.data.notes.find((item) => String(item.id) === noteId);
  const body = note?.markdownContent ?? note?.content ?? '';
  const capture = () => {
    if (!note) { setError('Choose a source note.'); return; }
    if (commit((current) => {
      const card = flashcardFromNote(note, question, answer, deck, skillId);
      return { ...current, records: [card, ...current.records] };
    })) {
      setQuestion(''); setAnswer(''); setSaved('Flashcard added to the review queue.');
    }
  };
  return <section className="shrink-0 border-b border-border px-4 py-3">
    <Button size="sm" variant="outline" aria-expanded={open} onClick={() => { setOpen(!open); setSaved(''); }}>Create from a note</Button>
    {open && <form className="mt-3 max-h-[50vh] space-y-3 overflow-y-auto" onSubmit={(event) => { event.preventDefault(); capture(); }}>
      <Choice label="Source note" value={noteId} options={workspace.data.notes.map((item) => ({ value: String(item.id), label: item.title }))}
        onChange={(id) => { setNoteId(id); setAnswer(''); setSaved(''); setError(''); }} />
      {!workspace.data.notes.length && <p className="text-sm text-muted-foreground">Create a note first, or add a flashcard directly below.</p>}
      {note && <>
        <Field label="Source passage" hint="Select a passage, then choose Use selected passage."><Textarea readOnly ref={passageRef} value={body} rows={5} /></Field>
        <Button type="button" variant="outline" size="sm" onClick={() => {
          const field = passageRef.current;
          if (!field || field.selectionStart === field.selectionEnd) { setError('Select some text in the source passage first.'); return; }
          setAnswer(body.slice(field.selectionStart, field.selectionEnd)); setError('');
        }}>Use selected passage</Button>
      </>}
      <Field label="Question"><Input required value={question} onChange={(event) => { setQuestion(event.target.value); setSaved(''); }} /></Field>
      <Field label="Answer"><Textarea required value={answer} onChange={(event) => setAnswer(event.target.value)} rows={3} /></Field>
      <Field label="Deck"><Input value={deck} onChange={(event) => setDeck(event.target.value)} /></Field>
      {skills.records.length > 0 && <Choice label="Skill" value={skillId} clearable options={skills.records.map((skill) => ({ value: skill.id, label: skill.title }))} onChange={setSkillId} />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {saved && <p role="status" className="text-sm text-success">{saved}</p>}
      <Button type="submit" size="sm" disabled={!note}>Add flashcard</Button>
    </form>}
  </section>;
}

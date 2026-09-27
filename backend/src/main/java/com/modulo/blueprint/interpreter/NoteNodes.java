package com.modulo.blueprint.interpreter;

import com.modulo.note.Note;
import com.modulo.tag.Tag;

import java.util.HashMap;
import java.util.Map;

/** Built-in note nodes: {@code action.note.create} and {@code action.tag.add}. */
final class NoteNodes {

    private final InterpreterDependencies deps;

    NoteNodes(InterpreterDependencies deps) {
        this.deps = deps;
    }

    NodeResult createNote(Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        Note note = new Note();
        note.setTitle((String) inputs.getOrDefault("title", "Untitled"));
        note.setContent((String) inputs.getOrDefault("content", ""));
        note = deps.noteService().save(note);
        outputs.put("note", note);
        return new NodeResult(outputs, "then");
    }

    NodeResult addTag(Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        Note note = (Note) inputs.get("note");
        String tagName = (String) inputs.get("tag");
        if (note != null && tagName != null && !tagName.isBlank()) {
            Tag tag = deps.tagService().createOrGetTag(tagName);
            note.getTags().add(tag);
            note = deps.noteService().save(note);
        }
        outputs.put("note", note);
        return new NodeResult(outputs, "then");
    }
}

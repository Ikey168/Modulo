package com.modulo.controller;

import com.modulo.entity.Note;
import com.modulo.service.MarkdownService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/notes")
@CrossOrigin(origins = "http://localhost:5173")
public class NoteController {

    @Autowired
    private MarkdownService markdownService;

    // Simple in-memory storage for demo purposes
    private final List<Note> notes = new ArrayList<>();
    private final AtomicLong idGenerator = new AtomicLong(1);

    public NoteController() {
        // Add some sample notes
        Note sampleNote = new Note();
        sampleNote.setId(idGenerator.getAndIncrement());
        sampleNote.setTitle("Welcome to Markdown Editor");
        sampleNote.setContent("This is your first note!");
        sampleNote.setMarkdownContent("# Welcome to Markdown Editor\n\nThis is your **first note** with *markdown* support!\n\n## Features\n- Live preview\n- Syntax highlighting\n- Easy editing\n\n```java\npublic class Hello {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}\n```");
        notes.add(sampleNote);
    }

    @PostMapping
    public ResponseEntity<Note> createNote(@RequestBody Note note) {
        note.setId(idGenerator.getAndIncrement());
        notes.add(note);
        return new ResponseEntity<>(note, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Note>> getAllNotes() {
        return new ResponseEntity<>(notes, HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Note> getNoteById(@PathVariable Long id) {
        Optional<Note> note = notes.stream()
                .filter(n -> n.getId().equals(id))
                .findFirst();
        
        if (note.isPresent()) {
            return new ResponseEntity<>(note.get(), HttpStatus.OK);
        } else {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Note> updateNote(@PathVariable Long id, @RequestBody Note updatedNote) {
        Optional<Note> existingNote = notes.stream()
                .filter(n -> n.getId().equals(id))
                .findFirst();
        
        if (existingNote.isPresent()) {
            Note note = existingNote.get();
            note.setTitle(updatedNote.getTitle());
            note.setContent(updatedNote.getContent());
            note.setMarkdownContent(updatedNote.getMarkdownContent());
            return new ResponseEntity<>(note, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNote(@PathVariable Long id) {
        boolean removed = notes.removeIf(n -> n.getId().equals(id));
        
        if (removed) {
            return new ResponseEntity<>(HttpStatus.NO_CONTENT);
        } else {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }
}
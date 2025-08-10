package com.modulo.controller;

import com.modulo.entity.Note;
// import com.modulo.entity.NoteLink; // Commented out
// import com.modulo.repository.neo4j.NoteRepository; // Commented out
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/api/notes")
@CrossOrigin(origins = "*")
public class NoteController {

    // private final NoteRepository noteRepository; // Commented out
    
    // Temporary in-memory storage until database is configured
    private final Map<Long, Note> noteStore = new ConcurrentHashMap<>();
    private final AtomicLong idCounter = new AtomicLong(1);

    // Updated constructor
    public NoteController(/*NoteRepository noteRepository*/) { // Commented out
        // this.noteRepository = noteRepository; // Commented out
        
        // Add some sample data
        Note sampleNote = new Note("Welcome to Notes", 
            "<h1>Welcome to Your Rich Text Notes!</h1><p>This is a sample note demonstrating the rich text editor capabilities.</p><h2>Features:</h2><ul><li><strong>Bold text</strong> and <em>italic text</em></li><li>Images (drag and drop supported)</li><li>Links and tables</li><li>Lists and headings</li></ul><p>Try editing this note or create a new one!</p>",
            "<h1>Welcome to Your Rich Text Notes!</h1><p>This is a sample note demonstrating the rich text editor capabilities.</p><h2>Features:</h2><ul><li><strong>Bold text</strong> and <em>italic text</em></li><li>Images (drag and drop supported)</li><li>Links and tables</li><li>Lists and headings</li></ul><p>Try editing this note or create a new one!</p>");
        sampleNote.setId(idCounter.getAndIncrement());
        noteStore.put(sampleNote.getId(), sampleNote);
    }

    @PostMapping
    public ResponseEntity<Note> createNote(@RequestBody Note note) {
        try {
            note.setId(idCounter.getAndIncrement());
            noteStore.put(note.getId(), note);
            return new ResponseEntity<>(note, HttpStatus.CREATED);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
        // Note savedNote = noteRepository.save(note); // Commented out
        // return new ResponseEntity<>(savedNote, HttpStatus.CREATED); // Commented out
    }

    @GetMapping
    public ResponseEntity<List<Note>> getAllNotes() {
        try {
            List<Note> notes = new ArrayList<>(noteStore.values());
            // Sort by ID (newest first)
            notes.sort((n1, n2) -> Long.compare(n2.getId(), n1.getId()));
            return new ResponseEntity<>(notes, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(Collections.emptyList(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
        // List<Note> notes = (List<Note>) noteRepository.findAll(); // Commented out
        // return new ResponseEntity<>(notes, HttpStatus.OK); // Commented out
    }

    @GetMapping("/{id}")
    public ResponseEntity<Note> getNoteById(@PathVariable Long id) {
        Note note = noteStore.get(id);
        if (note != null) {
            return new ResponseEntity<>(note, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Note> updateNote(@PathVariable Long id, @RequestBody Note noteUpdate) {
        Note existingNote = noteStore.get(id);
        if (existingNote != null) {
            existingNote.setTitle(noteUpdate.getTitle());
            existingNote.setContent(noteUpdate.getContent());
            existingNote.setMarkdownContent(noteUpdate.getMarkdownContent());
            noteStore.put(id, existingNote);
            return new ResponseEntity<>(existingNote, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNote(@PathVariable Long id) {
        if (noteStore.containsKey(id)) {
            noteStore.remove(id);
            return new ResponseEntity<>(HttpStatus.NO_CONTENT);
        } else {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }
}
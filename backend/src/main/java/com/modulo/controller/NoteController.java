package com.modulo.controller;

import com.modulo.entity.Note;
// import com.modulo.entity.NoteLink; // Commented out
// import com.modulo.repository.neo4j.NoteRepository; // Commented out
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections; // For empty list
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/notes")
public class NoteController {

    // private final NoteRepository noteRepository; // Commented out

    // Updated constructor
    public NoteController(/*NoteRepository noteRepository*/) { // Commented out
        // this.noteRepository = noteRepository; // Commented out
    }

    @PostMapping
    public ResponseEntity<Note> createNote(@RequestBody Note note) {
        // Note savedNote = noteRepository.save(note); // Commented out
        // return new ResponseEntity<>(savedNote, HttpStatus.CREATED); // Commented out
        return new ResponseEntity<>(note, HttpStatus.CREATED); // Temporary: return input note
    }

    /* // Commenting out createLink method as it depends on Neo4j components
    @PostMapping("/{sourceId}/links/{targetId}")
    public ResponseEntity<String> createLink(@PathVariable Long sourceId, @PathVariable Long targetId, @RequestParam String type) {
        Optional<Note> sourceOpt = noteRepository.findById(sourceId);
        Optional<Note> targetOpt = noteRepository.findById(targetId);

        if (sourceOpt.isEmpty() || targetOpt.isEmpty()) {
            return new ResponseEntity<>("Source or target note not found", HttpStatus.NOT_FOUND);
        }

        Note source = sourceOpt.get();
        Note target = targetOpt.get();

        // Create a new NoteLink. The constructor now takes the target node and the type.
        NoteLink newLink = new NoteLink(target, type);

        // Add the link to the source note's set of links
        source.addLink(newLink);

        // Save the source note, which will also persist the new relationship
        noteRepository.save(source);

        return new ResponseEntity<>("Link created successfully", HttpStatus.CREATED);
    }
    */

    @GetMapping
    public ResponseEntity<List<Note>> getAllNotes() {
        // List<Note> notes = (List<Note>) noteRepository.findAll(); // Commented out
        // return new ResponseEntity<>(notes, HttpStatus.OK); // Commented out
        return new ResponseEntity<>(Collections.emptyList(), HttpStatus.OK); // Temporary: return empty list
    }
}
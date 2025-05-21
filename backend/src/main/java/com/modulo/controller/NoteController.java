package com.modulo.controller;

import com.modulo.entity.Note;
import com.modulo.entity.NoteLink;
import com.modulo.repository.NoteRepository;
import com.modulo.repository.NoteLinkRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notes")
public class NoteController {

    private final NoteRepository noteRepository;
    private final NoteLinkRepository noteLinkRepository;

    public NoteController(NoteRepository noteRepository, NoteLinkRepository noteLinkRepository) {
        this.noteRepository = noteRepository;
        this.noteLinkRepository = noteLinkRepository;
    }

    @PostMapping
    public ResponseEntity<Note> createNote(@RequestBody Note note) {
        Note savedNote = noteRepository.save(note);
        return new ResponseEntity<>(savedNote, HttpStatus.CREATED);
    }

    @PostMapping("/{sourceId}/links/{targetId}")
    public ResponseEntity<String> createLink(@PathVariable Long sourceId, @PathVariable Long targetId, @RequestParam String type) {
        Note source = noteRepository.findById(sourceId).orElse(null);
        Note target = noteRepository.findById(targetId).orElse(null);

        if (source == null || target == null) {
            return new ResponseEntity<>("Source or target note not found", HttpStatus.NOT_FOUND);
        }

        NoteLink noteLink = new NoteLink(source, target, type);
        noteLinkRepository.save(noteLink);

        return new ResponseEntity<>("Link created successfully", HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Note>> getAllNotes() {
        List<Note> notes = (List<Note>) noteRepository.findAll();
        return new ResponseEntity<>(notes, HttpStatus.OK);
    }
}
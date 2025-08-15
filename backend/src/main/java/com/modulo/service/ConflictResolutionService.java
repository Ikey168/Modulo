package com.modulo.service;

import com.modulo.dto.ConflictResolutionDto;
import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import com.modulo.repository.NoteRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for handling edit conflicts and conflict resolution
 */
@Service
@RequiredArgsConstructor
public class ConflictResolutionService {
    
    private static final Logger log = LoggerFactory.getLogger(ConflictResolutionService.class);
    
    private final NoteRepository noteRepository;
    private final TagService tagService;
    
    /**
     * Checks for edit conflicts when updating a note
     */
    public ConflictResolutionDto checkForConflicts(Long noteId, Long expectedVersion, 
                                                  String incomingTitle, String incomingContent,
                                                  List<String> incomingTagNames, String currentEditor) {
        Optional<Note> noteOpt = noteRepository.findById(noteId);
        
        if (!noteOpt.isPresent()) {
            throw new IllegalArgumentException("Note not found: " + noteId);
        }
        
        Note currentNote = noteOpt.get();
        List<String> currentTagNames = currentNote.getTags() != null ? 
            currentNote.getTags().stream().map(Tag::getName).collect(Collectors.toList()) : 
            List.of();
        
        ConflictResolutionDto conflict = new ConflictResolutionDto(
            noteId,
            currentNote.getTitle(),
            currentNote.getContent(),
            incomingTitle,
            incomingContent,
            currentTagNames,
            incomingTagNames,
            currentNote.getUpdatedAt(),
            LocalDateTime.now(),
            currentNote.getLastEditor(),
            currentEditor,
            expectedVersion,
            currentNote.getVersion()
        );
        
        log.info("Conflict check for note {}: expectedVersion={}, actualVersion={}, hasConflict={}", 
                noteId, expectedVersion, currentNote.getVersion(), conflict.hasConflict());
        
        return conflict;
    }
    
    /**
     * Attempts to update a note with optimistic locking
     */
    @Transactional
    public Note updateNoteWithConflictCheck(Long noteId, Long expectedVersion, 
                                          String title, String content, String markdownContent,
                                          List<String> tagNames, String editor) {
        Optional<Note> noteOpt = noteRepository.findById(noteId);
        
        if (!noteOpt.isPresent()) {
            throw new IllegalArgumentException("Note not found: " + noteId);
        }
        
        Note note = noteOpt.get();
        
        // Check for version conflict
        if (!note.getVersion().equals(expectedVersion)) {
            log.warn("Version conflict detected for note {}: expected={}, actual={}", 
                    noteId, expectedVersion, note.getVersion());
            throw new ObjectOptimisticLockingFailureException(Note.class, noteId);
        }
        
        // Update note fields
        if (title != null) {
            note.setTitle(title);
        }
        if (content != null) {
            note.setContent(content);
        }
        if (markdownContent != null) {
            note.setMarkdownContent(markdownContent);
        }
        note.setLastEditor(editor);
        
        // Handle tags update
        if (tagNames != null) {
            note.getTags().clear();
            tagNames.stream()
                .map(tagService::createOrGetTag)
                .forEach(note::addTag);
        }
        
        Note savedNote = noteRepository.save(note);
        log.info("Successfully updated note {} to version {}", noteId, savedNote.getVersion());
        
        return savedNote;
    }
    
    /**
     * Force update a note after manual conflict resolution
     */
    @Transactional
    public Note forceUpdateNote(Long noteId, String title, String content, String markdownContent,
                               List<String> tagNames, String editor) {
        Optional<Note> noteOpt = noteRepository.findById(noteId);
        
        if (!noteOpt.isPresent()) {
            throw new IllegalArgumentException("Note not found: " + noteId);
        }
        
        Note note = noteOpt.get();
        
        // Force update without version check
        if (title != null) {
            note.setTitle(title);
        }
        if (content != null) {
            note.setContent(content);
        }
        if (markdownContent != null) {
            note.setMarkdownContent(markdownContent);
        }
        note.setLastEditor(editor);
        note.setUpdatedAt(LocalDateTime.now());
        
        // Handle tags update
        if (tagNames != null) {
            note.getTags().clear();
            tagNames.stream()
                .map(tagService::createOrGetTag)
                .forEach(note::addTag);
        }
        
        Note savedNote = noteRepository.save(note);
        log.info("Force updated note {} after conflict resolution", noteId);
        
        return savedNote;
    }
}

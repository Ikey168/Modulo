package com.modulo.service;

import com.modulo.entity.Note;
import com.modulo.entity.NoteLink;
import com.modulo.repository.NoteLinkRepository;
import com.modulo.repository.NoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class NoteLinkService {

    private final NoteLinkRepository noteLinkRepository;
    private final NoteRepository noteRepository;

    @Autowired
    public NoteLinkService(NoteLinkRepository noteLinkRepository, NoteRepository noteRepository) {
        this.noteLinkRepository = noteLinkRepository;
        this.noteRepository = noteRepository;
    }

    /**
     * Create a new link between two notes
     */
    public NoteLink createLink(Long sourceNoteId, Long targetNoteId, String linkType) {
        Optional<Note> sourceNote = noteRepository.findById(sourceNoteId);
        Optional<Note> targetNote = noteRepository.findById(targetNoteId);

        if (!sourceNote.isPresent() || !targetNote.isPresent()) {
            throw new IllegalArgumentException("Source or target note not found");
        }

        if (sourceNoteId.equals(targetNoteId)) {
            throw new IllegalArgumentException("Cannot link a note to itself");
        }

        NoteLink noteLink = new NoteLink(sourceNote.get(), targetNote.get(), linkType);
        return noteLinkRepository.save(noteLink);
    }

    /**
     * Get all links for a specific note (both incoming and outgoing)
     */
    public List<NoteLink> getLinksForNote(Long noteId) {
        Optional<Note> note = noteRepository.findById(noteId);
        if (!note.isPresent()) {
            throw new IllegalArgumentException("Note not found");
        }
        return noteLinkRepository.findBySourceNoteOrTargetNote(note.get());
    }

    /**
     * Get outgoing links from a note
     */
    public List<NoteLink> getOutgoingLinks(Long noteId) {
        return noteLinkRepository.findBySourceNoteId(noteId);
    }

    /**
     * Get incoming links to a note
     */
    public List<NoteLink> getIncomingLinks(Long noteId) {
        return noteLinkRepository.findByTargetNoteId(noteId);
    }

    /**
     * Get all links of a specific type
     */
    public List<NoteLink> getLinksByType(String linkType) {
        return noteLinkRepository.findByLinkType(linkType);
    }

    /**
     * Delete a link
     */
    public void deleteLink(UUID linkId) {
        noteLinkRepository.deleteById(linkId);
    }

    /**
     * Delete all links between two specific notes
     */
    public void deleteAllLinksBetweenNotes(Long sourceNoteId, Long targetNoteId) {
        List<NoteLink> links = noteLinkRepository.findBySourceNoteIdAndTargetNoteId(sourceNoteId, targetNoteId);
        noteLinkRepository.deleteAll(links);
    }

    /**
     * Check if a link exists between two notes
     */
    public boolean linkExists(Long sourceNoteId, Long targetNoteId) {
        return !noteLinkRepository.findBySourceNoteIdAndTargetNoteId(sourceNoteId, targetNoteId).isEmpty();
    }

    /**
     * Get all note links
     */
    public List<NoteLink> getAllLinks() {
        return noteLinkRepository.findAll();
    }

    /**
     * Find link by ID
     */
    public Optional<NoteLink> findById(UUID linkId) {
        return noteLinkRepository.findById(linkId);
    }

    /**
     * Update link type
     */
    public NoteLink updateLinkType(UUID linkId, String newLinkType) {
        Optional<NoteLink> linkOpt = noteLinkRepository.findById(linkId);
        if (!linkOpt.isPresent()) {
            throw new IllegalArgumentException("Link not found");
        }

        NoteLink link = linkOpt.get();
        link.setLinkType(newLinkType);
        return noteLinkRepository.save(link);
    }
}

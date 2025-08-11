package com.modulo.service;

import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import com.modulo.entity.offline.OfflineNote;
import com.modulo.repository.NoteRepository;
import com.modulo.repository.offline.OfflineNoteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service for synchronizing between PostgreSQL/H2 online database and SQLite offline storage
 */
@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.offline.database.enabled", havingValue = "true", matchIfMissing = true)
public class OfflineSyncService {

    private final OfflineNoteRepository offlineNoteRepository;
    private final NoteRepository noteRepository;
    private final TagService tagService;

    private volatile boolean syncInProgress = false;

    /**
     * Save a note to offline storage when online operations fail
     */
    @Transactional("offlineTransactionManager")
    public OfflineNote saveOffline(Note note) {
        log.info("Saving note to offline storage: {}", note.getTitle());
        
        OfflineNote offlineNote = convertToOfflineNote(note);
        return offlineNoteRepository.save(offlineNote);
    }

    /**
     * Create a new note offline
     */
    @Transactional("offlineTransactionManager")
    public OfflineNote createOfflineNote(String title, String content, Set<String> tags) {
        log.info("Creating new offline note: {}", title);
        
        OfflineNote offlineNote = new OfflineNote(title, content);
        offlineNote.setTagsFromSet(tags);
        offlineNote.setSyncStatus(OfflineNote.SyncStatus.PENDING_SYNC);
        
        return offlineNoteRepository.save(offlineNote);
    }

    /**
     * Update an existing offline note
     */
    @Transactional("offlineTransactionManager")
    public OfflineNote updateOfflineNote(Long id, String title, String content, Set<String> tags) {
        log.info("Updating offline note: {}", id);
        
        Optional<OfflineNote> optionalNote = offlineNoteRepository.findById(id);
        if (optionalNote.isPresent()) {
            OfflineNote offlineNote = optionalNote.get();
            offlineNote.setTitle(title);
            offlineNote.setContent(content);
            offlineNote.setMarkdownContent(content);
            offlineNote.setTagsFromSet(tags);
            offlineNote.markForSync();
            
            return offlineNoteRepository.save(offlineNote);
        }
        throw new RuntimeException("Offline note not found with ID: " + id);
    }

    /**
     * Delete an offline note (mark for deletion)
     */
    @Transactional("offlineTransactionManager")
    public void deleteOfflineNote(Long id) {
        log.info("Marking offline note for deletion: {}", id);
        
        Optional<OfflineNote> optionalNote = offlineNoteRepository.findById(id);
        if (optionalNote.isPresent()) {
            OfflineNote offlineNote = optionalNote.get();
            offlineNote.markForDeletion();
            offlineNoteRepository.save(offlineNote);
        }
    }

    /**
     * Get all active offline notes
     */
    @Transactional(value = "offlineTransactionManager", readOnly = true)
    public List<OfflineNote> getAllOfflineNotes() {
        return offlineNoteRepository.findAllActiveNotes();
    }

    /**
     * Search offline notes
     */
    @Transactional(value = "offlineTransactionManager", readOnly = true)
    public List<OfflineNote> searchOfflineNotes(String query) {
        return offlineNoteRepository.searchNotes(query);
    }

    /**
     * Get offline notes by tag
     */
    @Transactional(value = "offlineTransactionManager", readOnly = true)
    public List<OfflineNote> getOfflineNotesByTag(String tag) {
        return offlineNoteRepository.findByTagContaining(tag);
    }

    /**
     * Synchronize offline changes with online database
     */
    @Async
    @Scheduled(fixedDelay = 30000) // Run every 30 seconds
    public void syncOfflineChanges() {
        if (syncInProgress) {
            log.debug("Sync already in progress, skipping");
            return;
        }

        try {
            syncInProgress = true;
            log.info("Starting offline sync process");

            // Sync pending creations/updates
            syncPendingNotes();

            // Sync pending deletions
            syncPendingDeletions();

            // Pull latest changes from server
            pullServerChanges();

            // Cleanup old deleted notes
            cleanupDeletedNotes();

            log.info("Offline sync completed successfully");
        } catch (Exception e) {
            log.error("Error during offline sync", e);
        } finally {
            syncInProgress = false;
        }
    }

    /**
     * Sync notes that are pending sync to the server
     */
    private void syncPendingNotes() {
        List<OfflineNote> pendingNotes = offlineNoteRepository.findPendingSyncNotes();
        log.info("Syncing {} pending notes to server", pendingNotes.size());

        for (OfflineNote offlineNote : pendingNotes) {
            try {
                Note serverNote = convertToServerNote(offlineNote);
                
                if (offlineNote.getServerId() != null) {
                    // Update existing note
                    Optional<Note> existingNote = noteRepository.findById(offlineNote.getServerId());
                    if (existingNote.isPresent()) {
                        Note note = existingNote.get();
                        note.setTitle(serverNote.getTitle());
                        note.setContent(serverNote.getContent());
                        note.setMarkdownContent(serverNote.getMarkdownContent());
                        updateNoteTags(note, offlineNote.getTagsAsSet());
                        noteRepository.save(note);
                        log.info("Updated server note: {}", note.getId());
                    }
                } else {
                    // Create new note
                    updateNoteTags(serverNote, offlineNote.getTagsAsSet());
                    Note savedNote = noteRepository.save(serverNote);
                    offlineNote.setServerId(savedNote.getId());
                    log.info("Created new server note: {}", savedNote.getId());
                }

                offlineNote.markAsSynced();
                offlineNoteRepository.save(offlineNote);
                
            } catch (Exception e) {
                log.error("Failed to sync offline note: {}", offlineNote.getId(), e);
            }
        }
    }

    /**
     * Sync pending deletions to the server
     */
    private void syncPendingDeletions() {
        List<OfflineNote> pendingDeletes = offlineNoteRepository.findPendingDeleteNotes();
        log.info("Syncing {} pending deletions to server", pendingDeletes.size());

        for (OfflineNote offlineNote : pendingDeletes) {
            try {
                if (offlineNote.getServerId() != null) {
                    noteRepository.deleteById(offlineNote.getServerId());
                    log.info("Deleted server note: {}", offlineNote.getServerId());
                }
                
                offlineNote.markAsSynced();
                offlineNoteRepository.save(offlineNote);
                
            } catch (Exception e) {
                log.error("Failed to delete server note: {}", offlineNote.getServerId(), e);
            }
        }
    }

    /**
     * Pull latest changes from server and update offline storage
     */
    private void pullServerChanges() {
        try {
            List<Note> serverNotes = noteRepository.findAllWithTags();
            log.info("Pulling {} notes from server", serverNotes.size());

            for (Note serverNote : serverNotes) {
                Optional<OfflineNote> existingOffline = offlineNoteRepository.findByServerId(serverNote.getId());
                
                if (existingOffline.isPresent()) {
                    OfflineNote offlineNote = existingOffline.get();
                    
                    // Only update if server version is newer and local changes are synced
                    if (offlineNote.getSyncStatus() == OfflineNote.SyncStatus.SYNCED) {
                        updateOfflineFromServer(offlineNote, serverNote);
                        offlineNoteRepository.save(offlineNote);
                    }
                } else {
                    // Create new offline note from server
                    OfflineNote newOfflineNote = convertToOfflineNote(serverNote);
                    newOfflineNote.setServerId(serverNote.getId());
                    newOfflineNote.markAsSynced();
                    offlineNoteRepository.save(newOfflineNote);
                }
            }
        } catch (Exception e) {
            log.error("Failed to pull server changes", e);
        }
    }

    /**
     * Clean up deleted notes that are already synced
     */
    private void cleanupDeletedNotes() {
        try {
            offlineNoteRepository.cleanupDeletedSyncedNotes();
            log.info("Cleaned up deleted synced notes");
        } catch (Exception e) {
            log.error("Failed to cleanup deleted notes", e);
        }
    }

    /**
     * Convert server Note to OfflineNote
     */
    private OfflineNote convertToOfflineNote(Note note) {
        OfflineNote offlineNote = new OfflineNote();
        offlineNote.setServerId(note.getId());
        offlineNote.setTitle(note.getTitle());
        offlineNote.setContent(note.getContent());
        offlineNote.setMarkdownContent(note.getMarkdownContent());
        
        // Convert tags to comma-separated string
        Set<String> tagNames = note.getTags().stream()
                .map(Tag::getName)
                .collect(Collectors.toSet());
        offlineNote.setTagsFromSet(tagNames);
        
        return offlineNote;
    }

    /**
     * Convert OfflineNote to server Note
     */
    private Note convertToServerNote(OfflineNote offlineNote) {
        Note note = new Note();
        note.setTitle(offlineNote.getTitle());
        note.setContent(offlineNote.getContent());
        note.setMarkdownContent(offlineNote.getMarkdownContent());
        
        return note;
    }

    /**
     * Update offline note from server note
     */
    private void updateOfflineFromServer(OfflineNote offlineNote, Note serverNote) {
        offlineNote.setTitle(serverNote.getTitle());
        offlineNote.setContent(serverNote.getContent());
        offlineNote.setMarkdownContent(serverNote.getMarkdownContent());
        
        Set<String> tagNames = serverNote.getTags().stream()
                .map(Tag::getName)
                .collect(Collectors.toSet());
        offlineNote.setTagsFromSet(tagNames);
        
        offlineNote.markAsSynced();
    }

    /**
     * Update note tags from string set
     */
    private void updateNoteTags(Note note, Set<String> tagNames) {
        note.getTags().clear();
        for (String tagName : tagNames) {
            if (!tagName.trim().isEmpty()) {
                Tag tag = tagService.createOrGetTag(tagName.trim());
                note.addTag(tag);
            }
        }
    }

    /**
     * Get sync status information
     */
    @Transactional(value = "offlineTransactionManager", readOnly = true)
    public SyncStatus getSyncStatus() {
        long pendingSync = offlineNoteRepository.countPendingSyncNotes();
        long pendingDelete = offlineNoteRepository.countPendingDeleteNotes();
        
        return new SyncStatus(pendingSync, pendingDelete, syncInProgress);
    }

    /**
     * Force immediate sync
     */
    public void forcSync() {
        log.info("Forcing immediate sync");
        syncOfflineChanges();
    }

    /**
     * Sync status information
     */
    public static class SyncStatus {
        public final long pendingSyncCount;
        public final long pendingDeleteCount;
        public final boolean syncInProgress;

        public SyncStatus(long pendingSyncCount, long pendingDeleteCount, boolean syncInProgress) {
            this.pendingSyncCount = pendingSyncCount;
            this.pendingDeleteCount = pendingDeleteCount;
            this.syncInProgress = syncInProgress;
        }
    }
}

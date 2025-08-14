package com.modulo.service;

import com.modulo.entity.Note;
import com.modulo.entity.Attachment;
import com.modulo.entity.User;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.event.NoteEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityManager;
import javax.persistence.Query;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for note operations with plugin integration
 */
@Service
@Transactional
public class NoteService {
    
    private static final Logger logger = LoggerFactory.getLogger(NoteService.class);
    
    @Autowired
    private EntityManager entityManager;
    
    @Autowired
    private PluginEventBus eventBus;
    
    @Autowired
    private AttachmentService attachmentService;
    
    /**
     * Find note by ID
     */
    public Optional<Note> findById(Long id) {
        try {
            Note note = entityManager.find(Note.class, id);
            return Optional.ofNullable(note);
        } catch (Exception e) {
            logger.error("Error finding note by ID: " + id, e);
            return Optional.empty();
        }
    }
    
    /**
     * Save note (create or update)
     */
    public Note save(Note note) {
        boolean isNew = note.getId() == null;
        Note previousNote = null;
        
        if (!isNew) {
            previousNote = entityManager.find(Note.class, note.getId());
        }
        
        // Set timestamps
        LocalDateTime now = LocalDateTime.now();
        if (isNew) {
            note.setCreatedAt(now);
        }
        note.setUpdatedAt(now);
        
        // Save note
        Note savedNote = entityManager.merge(note);
        entityManager.flush();
        
        // Publish events
        if (isNew) {
            eventBus.publishAsync(new NoteEvent.NoteCreated(savedNote));
        } else {
            eventBus.publishAsync(new NoteEvent.NoteUpdated(savedNote, previousNote));
        }
        
        logger.debug("Note {} saved: {}", isNew ? "created" : "updated", savedNote.getId());
        return savedNote;
    }
    
    /**
     * Delete note by ID
     */
    public void deleteById(Long id) {
        Optional<Note> note = findById(id);
        if (note.isPresent()) {
            entityManager.remove(note.get());
            entityManager.flush();
            
            // Publish event
            eventBus.publishAsync(new NoteEvent.NoteDeleted(note.get()));
            
            logger.debug("Note deleted: {}", id);
        }
    }
    
    /**
     * Search notes with criteria
     */
    @SuppressWarnings("unchecked")
    public List<Note> searchNotes(String query, List<String> tags, Long userId, int limit, int offset) {
        StringBuilder sql = new StringBuilder("SELECT n FROM Note n WHERE 1=1");
        Map<String, Object> parameters = new HashMap<>();
        
        if (query != null && !query.trim().isEmpty()) {
            sql.append(" AND (LOWER(n.title) LIKE :query OR LOWER(n.content) LIKE :query)");
            parameters.put("query", "%" + query.toLowerCase() + "%");
        }
        
        if (userId != null) {
            sql.append(" AND n.userId = :userId");
            parameters.put("userId", userId);
        }
        
        if (tags != null && !tags.isEmpty()) {
            sql.append(" AND EXISTS (SELECT t FROM n.tags t WHERE t.name IN :tags)");
            parameters.put("tags", tags);
        }
        
        sql.append(" ORDER BY n.updatedAt DESC");
        
        Query jpqlQuery = entityManager.createQuery(sql.toString());
        parameters.forEach(jpqlQuery::setParameter);
        
        jpqlQuery.setFirstResult(offset);
        jpqlQuery.setMaxResults(limit);
        
        return jpqlQuery.getResultList();
    }
    
    /**
     * Find notes by user ID
     */
    @SuppressWarnings("unchecked")
    public List<Note> findByUserId(Long userId) {
        String jpql = "SELECT n FROM Note n WHERE n.userId = :userId ORDER BY n.updatedAt DESC";
        return entityManager.createQuery(jpql)
                .setParameter("userId", userId)
                .getResultList();
    }
    
    /**
     * Find notes by tag
     */
    @SuppressWarnings("unchecked")
    public List<Note> findByTag(String tag) {
        String jpql = "SELECT n FROM Note n JOIN n.tags t WHERE t.name = :tag ORDER BY n.updatedAt DESC";
        return entityManager.createQuery(jpql)
                .setParameter("tag", tag)
                .getResultList();
    }
    
    /**
     * Get note attachments
     */
    public List<Attachment> getAttachments(Long noteId) {
        return attachmentService.findByNoteId(noteId);
    }
    
    /**
     * Add custom metadata to note
     */
    public void addMetadata(Long noteId, Map<String, Object> metadata) {
        Optional<Note> noteOpt = findById(noteId);
        if (noteOpt.isPresent()) {
            Note note = noteOpt.get();
            
            // Initialize metadata if null
            if (note.getMetadata() == null) {
                note.setMetadata(new HashMap<>());
            }
            
            // Convert Object values to String (JSON serialization can be added here)
            Map<String, String> stringMetadata = new HashMap<>();
            for (Map.Entry<String, Object> entry : metadata.entrySet()) {
                stringMetadata.put(entry.getKey(), entry.getValue() != null ? entry.getValue().toString() : null);
            }
            
            // Add new metadata
            note.getMetadata().putAll(stringMetadata);
            note.setUpdatedAt(LocalDateTime.now());
            
            entityManager.merge(note);
            entityManager.flush();
            
            logger.debug("Added metadata to note {}: {}", noteId, metadata.keySet());
        }
    }
    
    /**
     * Get custom metadata for note
     */
    public Map<String, Object> getMetadata(Long noteId) {
        Optional<Note> note = findById(noteId);
        if (note.isPresent() && note.get().getMetadata() != null) {
            // Convert Map<String, String> to Map<String, Object> for backward compatibility
            Map<String, Object> objectMetadata = new HashMap<>();
            for (Map.Entry<String, String> entry : note.get().getMetadata().entrySet()) {
                objectMetadata.put(entry.getKey(), entry.getValue());
            }
            return objectMetadata;
        }
        return new HashMap<>();
    }
    
    /**
     * Get all notes (with pagination)
     */
    @SuppressWarnings("unchecked")
    public List<Note> findAll(int page, int size) {
        String jpql = "SELECT n FROM Note n ORDER BY n.updatedAt DESC";
        return entityManager.createQuery(jpql)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }
    
    /**
     * Count total notes
     */
    public long count() {
        String jpql = "SELECT COUNT(n) FROM Note n";
        return (Long) entityManager.createQuery(jpql).getSingleResult();
    }
    
    /**
     * Count notes by user
     */
    public long countByUserId(Long userId) {
        String jpql = "SELECT COUNT(n) FROM Note n WHERE n.userId = :userId";
        return (Long) entityManager.createQuery(jpql)
                .setParameter("userId", userId)
                .getSingleResult();
    }
    
    /**
     * Share note with user
     */
    public void shareNote(Long noteId, String shareType, String recipient) {
        Optional<Note> noteOpt = findById(noteId);
        if (noteOpt.isPresent()) {
            Note note = noteOpt.get();
            
            // Add sharing logic here based on your requirements
            // For now, just publish the event
            eventBus.publishAsync(new NoteEvent.NoteShared(note, shareType, recipient));
            
            logger.debug("Note {} shared via {} to {}", noteId, shareType, recipient);
        }
    }
    
    /**
     * Record note view
     */
    public void recordNoteView(Long noteId, Long viewerId) {
        Optional<Note> noteOpt = findById(noteId);
        if (noteOpt.isPresent()) {
            Note note = noteOpt.get();
            
            // Update view count or last viewed timestamp
            note.setLastViewedAt(LocalDateTime.now());
            entityManager.merge(note);
            
            // Publish event
            eventBus.publishAsync(new NoteEvent.NoteViewed(note, viewerId));
            
            logger.debug("Note {} viewed by user {}", noteId, viewerId);
        }
    }
    
    /**
     * Get current user ID from security context
     */
    private Long getCurrentUserId() {
        try {
            return 1L; // Placeholder - implement based on your security setup
        } catch (Exception e) {
            return null;
        }
    }
}

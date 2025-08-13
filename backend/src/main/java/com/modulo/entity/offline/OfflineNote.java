package com.modulo.entity.offline;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * SQLite-optimized Note entity for offline storage
 * Simplified structure to work well with SQLite limitations
 */
@Entity
@Table(name = "offline_notes")
public class OfflineNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "server_id")
    private Long serverId; // Reference to server Note ID

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "markdown_content", columnDefinition = "TEXT")
    private String markdownContent;

    @Column(name = "tags", columnDefinition = "TEXT")
    private String tags; // Stored as comma-separated string for SQLite simplicity

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "last_synced")
    private LocalDateTime lastSynced;

    @Column(name = "sync_status")
    @Enumerated(EnumType.STRING)
    private SyncStatus syncStatus;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @Column(name = "version")
    private Integer version = 0;

    public enum SyncStatus {
        SYNCED,        // In sync with server
        PENDING_SYNC,  // Modified locally, needs to be synced to server
        PENDING_DELETE // Marked for deletion on server
    }

    // Constructors
    public OfflineNote() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.syncStatus = SyncStatus.PENDING_SYNC;
    }

    public OfflineNote(String title, String content) {
        this();
        this.title = title;
        this.content = content;
        this.markdownContent = content;
    }

    public OfflineNote(String title, String content, String markdownContent) {
        this();
        this.title = title;
        this.content = content;
        this.markdownContent = markdownContent;
    }

    // Update timestamp when modified
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
        if (this.syncStatus == SyncStatus.SYNCED) {
            this.syncStatus = SyncStatus.PENDING_SYNC;
        }
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getServerId() {
        return serverId;
    }

    public void setServerId(Long serverId) {
        this.serverId = serverId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getMarkdownContent() {
        return markdownContent;
    }

    public void setMarkdownContent(String markdownContent) {
        this.markdownContent = markdownContent;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getLastSynced() {
        return lastSynced;
    }

    public void setLastSynced(LocalDateTime lastSynced) {
        this.lastSynced = lastSynced;
    }

    public SyncStatus getSyncStatus() {
        return syncStatus;
    }

    public void setSyncStatus(SyncStatus syncStatus) {
        this.syncStatus = syncStatus;
    }

    public Boolean getIsDeleted() {
        return isDeleted;
    }

    public void setIsDeleted(Boolean isDeleted) {
        this.isDeleted = isDeleted;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    // Helper methods for tag management
    public Set<String> getTagsAsSet() {
        Set<String> tagSet = new HashSet<>();
        if (tags != null && !tags.trim().isEmpty()) {
            String[] tagArray = tags.split(",");
            for (String tag : tagArray) {
                String trimmedTag = tag.trim();
                if (!trimmedTag.isEmpty()) {
                    tagSet.add(trimmedTag);
                }
            }
        }
        return tagSet;
    }

    public void setTagsFromSet(Set<String> tagSet) {
        if (tagSet == null || tagSet.isEmpty()) {
            this.tags = "";
        } else {
            this.tags = String.join(",", tagSet);
        }
    }

    // Mark for sync
    public void markForSync() {
        this.syncStatus = SyncStatus.PENDING_SYNC;
        this.updatedAt = LocalDateTime.now();
    }

    // Mark as synced
    public void markAsSynced() {
        this.syncStatus = SyncStatus.SYNCED;
        this.lastSynced = LocalDateTime.now();
    }

    // Mark for deletion
    public void markForDeletion() {
        this.isDeleted = true;
        this.syncStatus = SyncStatus.PENDING_DELETE;
        this.updatedAt = LocalDateTime.now();
    }
}

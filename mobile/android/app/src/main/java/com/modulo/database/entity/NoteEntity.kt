package com.modulo.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Room entity for offline note storage in Android app
 * Replaces LiteDB with Room (Kotlin) for mobile offline storage
 */
@Entity(tableName = "notes")
data class NoteEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    
    @ColumnInfo(name = "server_id")
    val serverId: Long? = null, // Reference to server Note ID
    
    @ColumnInfo(name = "title")
    val title: String,
    
    @ColumnInfo(name = "content")
    val content: String,
    
    @ColumnInfo(name = "markdown_content")
    val markdownContent: String? = null,
    
    @ColumnInfo(name = "tags")
    val tags: String = "", // Comma-separated tags for SQLite simplicity
    
    @ColumnInfo(name = "created_at")
    val createdAt: String = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
    
    @ColumnInfo(name = "updated_at")
    val updatedAt: String = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
    
    @ColumnInfo(name = "last_synced")
    val lastSynced: String? = null,
    
    @ColumnInfo(name = "sync_status")
    val syncStatus: SyncStatus = SyncStatus.PENDING_SYNC,
    
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false
) {
    /**
     * Sync status enum for tracking note synchronization state
     */
    enum class SyncStatus {
        PENDING_SYNC,    // Note needs to be synced to server
        SYNCED,          // Note is synchronized with server
        PENDING_DELETE,  // Note is marked for deletion and needs to be deleted on server
        SYNC_CONFLICT    // Sync conflict detected, needs manual resolution
    }
    
    /**
     * Helper method to get tags as a set
     */
    fun getTagsAsSet(): Set<String> {
        return if (tags.isBlank()) {
            emptySet()
        } else {
            tags.split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()
        }
    }
    
    /**
     * Helper method to create a new note marked for sync
     */
    fun markForSync(): NoteEntity {
        return this.copy(
            syncStatus = SyncStatus.PENDING_SYNC,
            updatedAt = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        )
    }
    
    /**
     * Helper method to mark note as synced
     */
    fun markAsSynced(): NoteEntity {
        return this.copy(
            syncStatus = SyncStatus.SYNCED,
            lastSynced = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        )
    }
    
    /**
     * Helper method to mark note for deletion
     */
    fun markForDeletion(): NoteEntity {
        return this.copy(
            isDeleted = true,
            syncStatus = SyncStatus.PENDING_DELETE,
            updatedAt = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        )
    }
    
    companion object {
        /**
         * Create a new note entity from title and content
         */
        fun create(title: String, content: String, tags: Set<String> = emptySet()): NoteEntity {
            return NoteEntity(
                title = title,
                content = content,
                markdownContent = content,
                tags = tags.joinToString(","),
                syncStatus = SyncStatus.PENDING_SYNC
            )
        }
        
        /**
         * Create note entity from server data
         */
        fun fromServer(
            serverId: Long,
            title: String,
            content: String,
            markdownContent: String?,
            tags: Set<String>
        ): NoteEntity {
            return NoteEntity(
                serverId = serverId,
                title = title,
                content = content,
                markdownContent = markdownContent ?: content,
                tags = tags.joinToString(","),
                syncStatus = SyncStatus.SYNCED,
                lastSynced = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            )
        }
    }
}

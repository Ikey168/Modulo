package com.modulo.database.dao

import androidx.room.*
import com.modulo.database.entity.NoteEntity
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for Note operations using Room
 * Provides offline-first data access with synchronization support
 */
@Dao
interface NoteDao {
    
    // ==================== QUERY OPERATIONS ====================
    
    /**
     * Get all active (non-deleted) notes, ordered by updated date
     */
    @Query("SELECT * FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC")
    fun getAllActiveNotes(): Flow<List<NoteEntity>>
    
    /**
     * Get all active notes as a list (for sync operations)
     */
    @Query("SELECT * FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC")
    suspend fun getAllActiveNotesList(): List<NoteEntity>
    
    /**
     * Get note by ID
     */
    @Query("SELECT * FROM notes WHERE id = :id")
    suspend fun getNoteById(id: Long): NoteEntity?
    
    /**
     * Get note by server ID
     */
    @Query("SELECT * FROM notes WHERE server_id = :serverId")
    suspend fun getNoteByServerId(serverId: Long): NoteEntity?
    
    /**
     * Search notes by title or content
     */
    @Query("""
        SELECT * FROM notes 
        WHERE is_deleted = 0 
        AND (title LIKE '%' || :query || '%' OR content LIKE '%' || :query || '%')
        ORDER BY updated_at DESC
    """)
    fun searchNotes(query: String): Flow<List<NoteEntity>>
    
    /**
     * Get notes by tag
     */
    @Query("""
        SELECT * FROM notes 
        WHERE is_deleted = 0 
        AND tags LIKE '%' || :tag || '%'
        ORDER BY updated_at DESC
    """)
    fun getNotesByTag(tag: String): Flow<List<NoteEntity>>
    
    // ==================== SYNC OPERATIONS ====================
    
    /**
     * Get notes that need to be synced to server
     */
    @Query("SELECT * FROM notes WHERE sync_status = 'PENDING_SYNC' AND is_deleted = 0")
    suspend fun getNotesForSync(): List<NoteEntity>
    
    /**
     * Get notes that are pending deletion
     */
    @Query("SELECT * FROM notes WHERE sync_status = 'PENDING_DELETE' AND is_deleted = 1")
    suspend fun getNotesForDeletion(): List<NoteEntity>
    
    /**
     * Get sync status counts
     */
    @Query("SELECT COUNT(*) FROM notes WHERE sync_status = 'PENDING_SYNC' AND is_deleted = 0")
    suspend fun getPendingSyncCount(): Int
    
    @Query("SELECT COUNT(*) FROM notes WHERE sync_status = 'PENDING_DELETE' AND is_deleted = 1")
    suspend fun getPendingDeleteCount(): Int
    
    @Query("SELECT COUNT(*) FROM notes WHERE sync_status = 'SYNCED' AND is_deleted = 0")
    suspend fun getSyncedCount(): Int
    
    /**
     * Get last sync time
     */
    @Query("SELECT MAX(last_synced) FROM notes WHERE last_synced IS NOT NULL")
    suspend fun getLastSyncTime(): String?
    
    // ==================== WRITE OPERATIONS ====================
    
    /**
     * Insert a new note
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNote(note: NoteEntity): Long
    
    /**
     * Insert multiple notes (for bulk operations)
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNotes(notes: List<NoteEntity>): List<Long>
    
    /**
     * Update an existing note
     */
    @Update
    suspend fun updateNote(note: NoteEntity)
    
    /**
     * Update multiple notes
     */
    @Update
    suspend fun updateNotes(notes: List<NoteEntity>)
    
    /**
     * Delete a note (hard delete)
     */
    @Delete
    suspend fun deleteNote(note: NoteEntity)
    
    /**
     * Delete note by ID
     */
    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun deleteNoteById(id: Long)
    
    // ==================== SYNC-SPECIFIC UPDATES ====================
    
    /**
     * Mark note as synced
     */
    @Query("""
        UPDATE notes 
        SET sync_status = 'SYNCED', last_synced = :syncTime 
        WHERE id = :id
    """)
    suspend fun markNoteAsSynced(id: Long, syncTime: String)
    
    /**
     * Update server ID after successful sync
     */
    @Query("UPDATE notes SET server_id = :serverId WHERE id = :id")
    suspend fun updateServerId(id: Long, serverId: Long)
    
    /**
     * Mark note for sync
     */
    @Query("""
        UPDATE notes 
        SET sync_status = 'PENDING_SYNC', updated_at = :updateTime 
        WHERE id = :id
    """)
    suspend fun markNoteForSync(id: Long, updateTime: String)
    
    /**
     * Mark note for deletion
     */
    @Query("""
        UPDATE notes 
        SET is_deleted = 1, sync_status = 'PENDING_DELETE', updated_at = :updateTime 
        WHERE id = :id
    """)
    suspend fun markNoteForDeletion(id: Long, updateTime: String)
    
    // ==================== CLEANUP OPERATIONS ====================
    
    /**
     * Clean up deleted notes that have been synced
     */
    @Query("DELETE FROM notes WHERE is_deleted = 1 AND sync_status = 'SYNCED'")
    suspend fun cleanupSyncedDeletedNotes(): Int
    
    /**
     * Get notes modified after a certain timestamp
     */
    @Query("SELECT * FROM notes WHERE updated_at > :since ORDER BY updated_at DESC")
    suspend fun getNotesModifiedAfter(since: String): List<NoteEntity>
    
    /**
     * Count total notes (including deleted)
     */
    @Query("SELECT COUNT(*) FROM notes")
    suspend fun getTotalNotesCount(): Int
    
    /**
     * Count active notes
     */
    @Query("SELECT COUNT(*) FROM notes WHERE is_deleted = 0")
    suspend fun getActiveNotesCount(): Int
    
    // ==================== ADVANCED QUERY OPERATIONS ====================
    
    /**
     * Get notes with pagination
     */
    @Query("""
        SELECT * FROM notes 
        WHERE is_deleted = 0 
        ORDER BY updated_at DESC 
        LIMIT :limit OFFSET :offset
    """)
    suspend fun getNotesWithPagination(limit: Int, offset: Int): List<NoteEntity>
    
    /**
     * Get distinct tags from all notes
     */
    @Query("SELECT DISTINCT tags FROM notes WHERE is_deleted = 0 AND tags != ''")
    suspend fun getAllTags(): List<String>
    
    /**
     * Get notes created within a date range
     */
    @Query("""
        SELECT * FROM notes 
        WHERE is_deleted = 0 
        AND created_at BETWEEN :startDate AND :endDate
        ORDER BY created_at DESC
    """)
    fun getNotesInDateRange(startDate: String, endDate: String): Flow<List<NoteEntity>>
}

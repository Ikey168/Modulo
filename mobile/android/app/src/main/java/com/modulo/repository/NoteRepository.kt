package com.modulo.repository

import com.modulo.database.dao.NoteDao
import com.modulo.database.entity.NoteEntity
import com.modulo.network.api.NotesApiService
import com.modulo.network.model.NoteDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import java.util.UUID
import java.util.Date

/**
 * Repository for Note management with offline-first approach
 * Handles both local Room database and remote API synchronization
 */
class NoteRepository(
    private val noteDao: NoteDao,
    private val apiService: NotesApiService
) {
    
    /**
     * Get all notes as Flow for reactive updates
     */
    fun getAllNotes(): Flow<List<NoteEntity>> = noteDao.getAllNotesFlow()
    
    /**
     * Get notes by sync status
     */
    fun getNotesByStatus(status: NoteEntity.SyncStatus): Flow<List<NoteEntity>> =
        noteDao.getNotesBySyncStatusFlow(status)
    
    /**
     * Get a specific note by ID
     */
    suspend fun getNoteById(id: String): NoteEntity? = noteDao.getNoteById(id)
    
    /**
     * Get notes that need synchronization
     */
    suspend fun getNotesForSync(): List<NoteEntity> = noteDao.getNotesForSync()
    
    /**
     * Create a new note (offline-first)
     */
    suspend fun createNote(title: String, content: String): NoteEntity {
        val note = NoteEntity.create(title, content)
        noteDao.insert(note)
        
        // Attempt immediate sync if online
        trySyncNote(note.id)
        
        return note
    }
    
    /**
     * Update an existing note (offline-first)
     */
    suspend fun updateNote(id: String, title: String, content: String): Boolean {
        val existingNote = noteDao.getNoteById(id) ?: return false
        
        val updatedNote = existingNote.copy(
            title = title,
            content = content,
            updatedAt = Date(),
            syncStatus = NoteEntity.SyncStatus.PENDING_SYNC
        )
        
        noteDao.update(updatedNote)
        
        // Attempt immediate sync if online
        trySyncNote(id)
        
        return true
    }
    
    /**
     * Delete a note (offline-first)
     */
    suspend fun deleteNote(id: String): Boolean {
        val note = noteDao.getNoteById(id) ?: return false
        
        if (note.serverId != null) {
            // Mark for deletion if it exists on server
            val markedForDeletion = note.markForDeletion()
            noteDao.update(markedForDeletion)
            
            // Attempt immediate sync if online
            trySyncNote(id)
        } else {
            // Delete immediately if it was never synced
            noteDao.delete(note)
        }
        
        return true
    }
    
    /**
     * Sync all pending changes with server
     */
    suspend fun syncAllNotes(): SyncResult {
        val notesToSync = getNotesForSync()
        var successCount = 0
        var failureCount = 0
        val errors = mutableListOf<String>()
        
        for (note in notesToSync) {
            try {
                when (note.syncStatus) {
                    NoteEntity.SyncStatus.PENDING_SYNC -> {
                        if (note.serverId != null) {
                            updateNoteOnServer(note)
                        } else {
                            createNoteOnServer(note)
                        }
                        successCount++
                    }
                    NoteEntity.SyncStatus.PENDING_DELETION -> {
                        deleteNoteOnServer(note)
                        successCount++
                    }
                    else -> {} // No action needed
                }
            } catch (e: Exception) {
                failureCount++
                errors.add("Failed to sync note ${note.id}: ${e.message}")
                
                // Mark as sync error
                val errorNote = note.markSyncError()
                noteDao.update(errorNote)
            }
        }
        
        // Download server changes
        try {
            downloadServerChanges()
        } catch (e: Exception) {
            errors.add("Failed to download server changes: ${e.message}")
        }
        
        return SyncResult(successCount, failureCount, errors)
    }
    
    /**
     * Try to sync a single note immediately
     */
    private suspend fun trySyncNote(noteId: String) {
        try {
            val note = noteDao.getNoteById(noteId) ?: return
            
            when (note.syncStatus) {
                NoteEntity.SyncStatus.PENDING_SYNC -> {
                    if (note.serverId != null) {
                        updateNoteOnServer(note)
                    } else {
                        createNoteOnServer(note)
                    }
                }
                NoteEntity.SyncStatus.PENDING_DELETION -> {
                    deleteNoteOnServer(note)
                }
                else -> {} // No sync needed
            }
        } catch (e: Exception) {
            // Silent failure, will be retried during full sync
            val note = noteDao.getNoteById(noteId)
            if (note != null) {
                val errorNote = note.markSyncError()
                noteDao.update(errorNote)
            }
        }
    }
    
    /**
     * Create note on server
     */
    private suspend fun createNoteOnServer(note: NoteEntity) {
        val noteDto = NoteDto(
            id = null, // Server will assign ID
            title = note.title,
            content = note.content,
            createdAt = note.createdAt,
            updatedAt = note.updatedAt
        )
        
        val serverNote = apiService.createNote(noteDto)
        
        // Update local note with server ID and mark as synced
        val syncedNote = note.copy(
            serverId = serverNote.id.toString(),
            syncStatus = NoteEntity.SyncStatus.SYNCED
        )
        noteDao.update(syncedNote)
    }
    
    /**
     * Update note on server
     */
    private suspend fun updateNoteOnServer(note: NoteEntity) {
        val serverId = note.serverId ?: throw IllegalStateException("Cannot update note without server ID")
        
        val noteDto = NoteDto(
            id = serverId.toLong(),
            title = note.title,
            content = note.content,
            createdAt = note.createdAt,
            updatedAt = note.updatedAt
        )
        
        apiService.updateNote(serverId.toLong(), noteDto)
        
        // Mark as synced
        val syncedNote = note.markSynced()
        noteDao.update(syncedNote)
    }
    
    /**
     * Delete note on server
     */
    private suspend fun deleteNoteOnServer(note: NoteEntity) {
        val serverId = note.serverId ?: throw IllegalStateException("Cannot delete note without server ID")
        
        apiService.deleteNote(serverId.toLong())
        
        // Remove from local database
        noteDao.delete(note)
    }
    
    /**
     * Download and merge server changes
     */
    private suspend fun downloadServerChanges() {
        val serverNotes = apiService.getAllNotes()
        
        for (serverNote in serverNotes) {
            val existingNote = noteDao.getNoteByServerId(serverNote.id.toString())
            
            if (existingNote == null) {
                // New note from server
                val localNote = NoteEntity.fromServer(
                    serverId = serverNote.id.toString(),
                    title = serverNote.title,
                    content = serverNote.content,
                    createdAt = serverNote.createdAt,
                    updatedAt = serverNote.updatedAt
                )
                noteDao.insert(localNote)
            } else if (existingNote.syncStatus == NoteEntity.SyncStatus.SYNCED) {
                // Update if server version is newer and local version is synced
                if (serverNote.updatedAt.after(existingNote.updatedAt)) {
                    val updatedNote = existingNote.copy(
                        title = serverNote.title,
                        content = serverNote.content,
                        updatedAt = serverNote.updatedAt,
                        syncStatus = NoteEntity.SyncStatus.SYNCED
                    )
                    noteDao.update(updatedNote)
                }
            }
            // Skip if local note has pending changes (conflict resolution needed)
        }
    }
    
    /**
     * Clean up old sync errors (retry after some time)
     */
    suspend fun retryFailedSyncs() {
        val errorNotes = noteDao.getNotesBySyncStatus(NoteEntity.SyncStatus.SYNC_ERROR)
        
        for (note in errorNotes) {
            val updatedNote = note.copy(syncStatus = NoteEntity.SyncStatus.PENDING_SYNC)
            noteDao.update(updatedNote)
        }
    }
    
    /**
     * Get sync statistics
     */
    suspend fun getSyncStats(): SyncStats {
        val totalNotes = noteDao.getNotesCount()
        val syncedCount = noteDao.getNotesCountByStatus(NoteEntity.SyncStatus.SYNCED)
        val pendingCount = noteDao.getNotesCountByStatus(NoteEntity.SyncStatus.PENDING_SYNC)
        val errorCount = noteDao.getNotesCountByStatus(NoteEntity.SyncStatus.SYNC_ERROR)
        val deletionCount = noteDao.getNotesCountByStatus(NoteEntity.SyncStatus.PENDING_DELETION)
        
        return SyncStats(
            totalNotes = totalNotes,
            syncedNotes = syncedCount,
            pendingSyncNotes = pendingCount,
            pendingDeletionNotes = deletionCount,
            syncErrorNotes = errorCount
        )
    }
}

/**
 * Result of sync operation
 */
data class SyncResult(
    val successCount: Int,
    val failureCount: Int,
    val errors: List<String>
) {
    val isSuccess: Boolean get() = failureCount == 0
    val hasPartialFailure: Boolean get() = failureCount > 0 && successCount > 0
}

/**
 * Sync statistics
 */
data class SyncStats(
    val totalNotes: Int,
    val syncedNotes: Int,
    val pendingSyncNotes: Int,
    val pendingDeletionNotes: Int,
    val syncErrorNotes: Int
) {
    val isSynced: Boolean get() = pendingSyncNotes == 0 && pendingDeletionNotes == 0 && syncErrorNotes == 0
}

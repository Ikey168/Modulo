package com.modulo.network.api

import com.modulo.network.model.NoteDto
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit API interface for Notes service
 * Handles communication with backend REST API
 */
interface NotesApiService {
    
    /**
     * Get all notes for the current user
     */
    @GET("api/notes")
    suspend fun getAllNotes(): List<NoteDto>
    
    /**
     * Get a specific note by ID
     */
    @GET("api/notes/{id}")
    suspend fun getNoteById(@Path("id") id: Long): NoteDto
    
    /**
     * Create a new note
     */
    @POST("api/notes")
    suspend fun createNote(@Body note: NoteDto): NoteDto
    
    /**
     * Update an existing note
     */
    @PUT("api/notes/{id}")
    suspend fun updateNote(@Path("id") id: Long, @Body note: NoteDto): NoteDto
    
    /**
     * Delete a note
     */
    @DELETE("api/notes/{id}")
    suspend fun deleteNote(@Path("id") id: Long): Response<Void>
    
    /**
     * Get notes modified since a specific timestamp
     * Useful for incremental sync
     */
    @GET("api/notes/since/{timestamp}")
    suspend fun getNotesModifiedSince(@Path("timestamp") timestamp: Long): List<NoteDto>
    
    /**
     * Batch sync operations
     */
    @POST("api/notes/sync")
    suspend fun syncNotes(@Body syncRequest: SyncRequest): SyncResponse
}

/**
 * Request for batch sync operation
 */
data class SyncRequest(
    val notesToCreate: List<NoteDto>,
    val notesToUpdate: List<NoteDto>, 
    val noteIdsToDelete: List<Long>,
    val lastSyncTimestamp: Long?
)

/**
 * Response from batch sync operation
 */
data class SyncResponse(
    val createdNotes: List<NoteDto>,
    val updatedNotes: List<NoteDto>,
    val deletedNoteIds: List<Long>,
    val serverNotes: List<NoteDto>,
    val conflicts: List<ConflictInfo>,
    val timestamp: Long
)

/**
 * Information about sync conflicts
 */
data class ConflictInfo(
    val localNoteId: String,
    val serverNote: NoteDto,
    val conflictType: ConflictType
)

enum class ConflictType {
    MODIFIED_BOTH,
    DELETED_LOCALLY_MODIFIED_REMOTELY,
    MODIFIED_LOCALLY_DELETED_REMOTELY
}

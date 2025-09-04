package com.modulo.database.converter

import androidx.room.TypeConverter
import com.modulo.database.entity.NoteEntity

/**
 * Type converters for Room database
 * Handles conversion between Kotlin types and SQLite types
 */
class Converters {
    
    /**
     * Convert SyncStatus enum to string for storage
     */
    @TypeConverter
    fun fromSyncStatus(syncStatus: NoteEntity.SyncStatus): String {
        return syncStatus.name
    }
    
    /**
     * Convert string to SyncStatus enum from storage
     */
    @TypeConverter
    fun toSyncStatus(syncStatus: String): NoteEntity.SyncStatus {
        return try {
            NoteEntity.SyncStatus.valueOf(syncStatus)
        } catch (e: IllegalArgumentException) {
            // Default fallback for unknown values
            NoteEntity.SyncStatus.PENDING_SYNC
        }
    }
}

package com.modulo.database

import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import android.content.Context
import com.modulo.database.dao.NoteDao
import com.modulo.database.entity.NoteEntity
import com.modulo.database.converter.Converters

/**
 * Room Database for Modulo mobile app offline storage
 * Replaces LiteDB with Room (Kotlin) for better Android integration
 */
@Database(
    entities = [NoteEntity::class],
    version = 2,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class ModuloDatabase : RoomDatabase() {
    
    /**
     * Data Access Object for Note operations
     */
    abstract fun noteDao(): NoteDao
    
    companion object {
        private const val DATABASE_NAME = "modulo_database"
        
        @Volatile
        private var INSTANCE: ModuloDatabase? = null
        
        /**
         * Get database instance (Singleton pattern)
         */
        fun getDatabase(context: Context): ModuloDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    ModuloDatabase::class.java,
                    DATABASE_NAME
                )
                .addMigrations(MIGRATION_1_2)
                .fallbackToDestructiveMigration() // For development - remove in production
                .build()
                INSTANCE = instance
                instance
            }
        }
        
        /**
         * Migration from version 1 to 2
         * Adds new columns for enhanced sync functionality
         */
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // Add new columns with default values
                database.execSQL(
                    "ALTER TABLE notes ADD COLUMN markdown_content TEXT DEFAULT NULL"
                )
                database.execSQL(
                    "ALTER TABLE notes ADD COLUMN last_synced TEXT DEFAULT NULL"
                )
                
                // Create index for better performance
                database.execSQL(
                    "CREATE INDEX IF NOT EXISTS index_notes_server_id ON notes(server_id)"
                )
                database.execSQL(
                    "CREATE INDEX IF NOT EXISTS index_notes_sync_status ON notes(sync_status)"
                )
                database.execSQL(
                    "CREATE INDEX IF NOT EXISTS index_notes_updated_at ON notes(updated_at)"
                )
            }
        }
        
        /**
         * Close database instance (for testing)
         */
        fun closeDatabase() {
            INSTANCE?.close()
            INSTANCE = null
        }
    }
}

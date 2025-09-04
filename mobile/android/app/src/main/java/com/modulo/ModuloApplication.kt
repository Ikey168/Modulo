package com.modulo

import android.app.Application
import androidx.work.Configuration
import androidx.work.WorkManager
import com.modulo.sync.SyncService

/**
 * Application class for Modulo mobile app
 * Initializes core services and dependencies
 */
class ModuloApplication : Application(), Configuration.Provider {
    
    // TODO: Replace with proper dependency injection (Hilt/Koin)
    // For now, using simple singleton pattern
    
    lateinit var syncService: SyncService
        private set
    
    override fun onCreate() {
        super.onCreate()
        
        initializeServices()
    }
    
    /**
     * Initialize core services
     */
    private fun initializeServices() {
        // Initialize WorkManager
        WorkManager.initialize(this, workManagerConfiguration)
        
        // Initialize sync service
        // syncService = SyncService(noteRepository, this)
        // syncService.schedulePeriodicSync()
        
        // TODO: Initialize other services like:
        // - Database
        // - Network client
        // - Repository
        // - Authentication manager
    }
    
    /**
     * WorkManager configuration
     */
    override fun getWorkManagerConfiguration(): Configuration {
        return Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()
    }
}

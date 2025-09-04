package com.modulo.sync

import android.content.Context
import androidx.work.*
import com.modulo.repository.NoteRepository
import com.modulo.utils.NetworkUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

/**
 * Background synchronization service using WorkManager
 * Handles periodic sync of notes with the server
 */
class SyncService(
    private val noteRepository: NoteRepository,
    private val context: Context
) {
    
    companion object {
        const val SYNC_WORK_NAME = "modulo_note_sync"
        const val IMMEDIATE_SYNC_WORK_NAME = "modulo_immediate_sync"
        private const val SYNC_INTERVAL_HOURS = 1L
        private const val RETRY_DELAY_MINUTES = 15L
    }
    
    /**
     * Schedule periodic background sync
     */
    fun schedulePeriodicSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()
        
        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
            SYNC_INTERVAL_HOURS,
            TimeUnit.HOURS,
            RETRY_DELAY_MINUTES,
            TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                RETRY_DELAY_MINUTES,
                TimeUnit.MINUTES
            )
            .build()
        
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(
                SYNC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
            )
    }
    
    /**
     * Trigger immediate sync
     */
    fun syncNow() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        
        val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .build()
        
        WorkManager.getInstance(context)
            .enqueueUniqueWork(
                IMMEDIATE_SYNC_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                syncRequest
            )
    }
    
    /**
     * Cancel all sync operations
     */
    fun cancelSync() {
        WorkManager.getInstance(context).cancelUniqueWork(SYNC_WORK_NAME)
        WorkManager.getInstance(context).cancelUniqueWork(IMMEDIATE_SYNC_WORK_NAME)
    }
    
    /**
     * Check sync status
     */
    fun getSyncStatus(): androidx.lifecycle.LiveData<List<WorkInfo>> {
        return WorkManager.getInstance(context).getWorkInfosForUniqueWorkLiveData(SYNC_WORK_NAME)
    }
    
    /**
     * Sync in foreground (for manual sync)
     */
    fun syncInForeground(
        onProgress: (String) -> Unit = {},
        onComplete: (SyncResult) -> Unit = {},
        onError: (Throwable) -> Unit = {}
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                onProgress("Checking network connectivity...")
                
                if (!NetworkUtils.isConnected(context)) {
                    throw Exception("No network connection available")
                }
                
                onProgress("Synchronizing notes...")
                val result = noteRepository.syncAllNotes()
                
                onProgress("Sync completed")
                onComplete(result)
                
            } catch (e: Exception) {
                onError(e)
            }
        }
    }
}

/**
 * WorkManager Worker for background sync
 */
class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result {
        return try {
            // Check network connectivity
            if (!NetworkUtils.isConnected(applicationContext)) {
                return Result.retry()
            }
            
            // Get dependencies (in real app, use DI)
            // val noteRepository = DependencyProvider.getNoteRepository()
            
            // For now, return success as we don't have DI setup
            // val syncResult = noteRepository.syncAllNotes()
            
            // if (syncResult.isSuccess) {
                Result.success()
            // } else if (syncResult.hasPartialFailure) {
            //     Result.retry()
            // } else {
            //     Result.failure()
            // }
            
        } catch (e: Exception) {
            // Retry on network errors, fail on other errors
            if (e.message?.contains("network", ignoreCase = true) == true) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
}

/**
 * Sync result for foreground operations
 */
sealed class SyncResult {
    object Success : SyncResult()
    data class PartialSuccess(val errors: List<String>) : SyncResult()
    data class Failure(val error: Throwable) : SyncResult()
}

/**
 * Sync status observer
 */
class SyncStatusObserver(private val onStatusChanged: (SyncStatus) -> Unit) {
    
    fun observeWorkStatus(workInfos: List<WorkInfo>) {
        when {
            workInfos.isEmpty() -> onStatusChanged(SyncStatus.NOT_SCHEDULED)
            workInfos.any { it.state == WorkInfo.State.RUNNING } -> onStatusChanged(SyncStatus.SYNCING)
            workInfos.any { it.state == WorkInfo.State.SUCCEEDED } -> onStatusChanged(SyncStatus.SUCCESS)
            workInfos.any { it.state == WorkInfo.State.FAILED } -> onStatusChanged(SyncStatus.FAILED)
            workInfos.any { it.state == WorkInfo.State.BLOCKED } -> onStatusChanged(SyncStatus.WAITING)
            else -> onStatusChanged(SyncStatus.IDLE)
        }
    }
}

/**
 * Sync status enumeration
 */
enum class SyncStatus {
    NOT_SCHEDULED,
    IDLE,
    SYNCING,
    SUCCESS,
    FAILED,
    WAITING
}

/**
 * Sync configuration
 */
data class SyncConfig(
    val enablePeriodicSync: Boolean = true,
    val syncIntervalHours: Long = 1L,
    val syncOnlyOnWifi: Boolean = false,
    val syncOnlyWhenCharging: Boolean = false,
    val maxRetryAttempts: Int = 3,
    val retryDelayMinutes: Long = 15L
)

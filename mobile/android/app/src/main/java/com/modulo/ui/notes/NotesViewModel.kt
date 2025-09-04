package com.modulo.ui.notes

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.asLiveData
import androidx.lifecycle.viewModelScope
import com.modulo.database.entity.NoteEntity
import com.modulo.repository.NoteRepository
import kotlinx.coroutines.launch

/**
 * ViewModel for Notes list screen
 * Manages note data and sync operations
 */
class NotesViewModel(
    // TODO: Inject via dependency injection
    private val noteRepository: NoteRepository? = null
) : ViewModel() {
    
    private val _syncStatus = MutableLiveData<SyncStatus>()
    val syncStatus: LiveData<SyncStatus> = _syncStatus
    
    private val _errorMessage = MutableLiveData<String?>()
    val errorMessage: LiveData<String?> = _errorMessage
    
    // Notes from repository as LiveData
    val notes: LiveData<List<NoteEntity>> = 
        noteRepository?.getAllNotes()?.asLiveData() ?: MutableLiveData(emptyList())
    
    init {
        // Initial sync status
        _syncStatus.value = SyncStatus()
        
        // Load initial sync stats
        loadSyncStats()
    }
    
    /**
     * Trigger manual sync
     */
    fun syncNotes() {
        if (noteRepository == null) {
            _errorMessage.value = "Repository not available"
            return
        }
        
        viewModelScope.launch {
            try {
                _syncStatus.value = _syncStatus.value?.copy(isLoading = true)
                
                val result = noteRepository.syncAllNotes()
                
                if (result.isSuccess) {
                    _syncStatus.value = _syncStatus.value?.copy(
                        isLoading = false,
                        lastSyncTime = System.currentTimeMillis()
                    )
                } else {
                    _errorMessage.value = "Sync failed: ${result.errors.firstOrNull()}"
                    _syncStatus.value = _syncStatus.value?.copy(isLoading = false)
                }
                
                // Refresh sync stats
                loadSyncStats()
                
            } catch (e: Exception) {
                _errorMessage.value = "Sync error: ${e.message}"
                _syncStatus.value = _syncStatus.value?.copy(isLoading = false)
            }
        }
    }
    
    /**
     * Load sync statistics
     */
    private fun loadSyncStats() {
        if (noteRepository == null) return
        
        viewModelScope.launch {
            try {
                val stats = noteRepository.getSyncStats()
                _syncStatus.value = _syncStatus.value?.copy(
                    pendingCount = stats.pendingSyncNotes + stats.pendingDeletionNotes,
                    errorCount = stats.syncErrorNotes
                )
            } catch (e: Exception) {
                // Silent failure, don't show error for stats loading
            }
        }
    }
    
    /**
     * Retry failed syncs
     */
    fun retryFailedSyncs() {
        if (noteRepository == null) return
        
        viewModelScope.launch {
            try {
                noteRepository.retryFailedSyncs()
                syncNotes() // Trigger new sync attempt
            } catch (e: Exception) {
                _errorMessage.value = "Retry failed: ${e.message}"
            }
        }
    }
    
    /**
     * Clear error message after showing
     */
    fun clearError() {
        _errorMessage.value = null
    }
    
    /**
     * Refresh notes and sync status
     */
    fun refresh() {
        loadSyncStats()
        // Notes are automatically refreshed via Flow/LiveData
    }
}

package com.modulo.repository.offline;

import com.modulo.entity.offline.OfflineNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for SQLite offline note storage
 */
@Repository
public interface OfflineNoteRepository extends JpaRepository<OfflineNote, Long> {

    // Find by server ID (for sync purposes)
    Optional<OfflineNote> findByServerId(Long serverId);

    // Find all notes that need to be synced
    @Query("SELECT n FROM OfflineNote n WHERE n.syncStatus = 'PENDING_SYNC' AND n.isDeleted = false")
    List<OfflineNote> findPendingSyncNotes();

    // Find all notes marked for deletion
    @Query("SELECT n FROM OfflineNote n WHERE n.syncStatus = 'PENDING_DELETE' AND n.isDeleted = true")
    List<OfflineNote> findPendingDeleteNotes();

    // Find all synced notes
    @Query("SELECT n FROM OfflineNote n WHERE n.syncStatus = 'SYNCED' AND n.isDeleted = false")
    List<OfflineNote> findSyncedNotes();

    // Find all active (non-deleted) notes
    @Query("SELECT n FROM OfflineNote n WHERE n.isDeleted = false ORDER BY n.updatedAt DESC")
    List<OfflineNote> findAllActiveNotes();

    // Search notes by title or content
    @Query("SELECT n FROM OfflineNote n WHERE n.isDeleted = false AND " +
           "(LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY n.updatedAt DESC")
    List<OfflineNote> searchNotes(@Param("query") String query);

    // Find notes by tag (using simple string search in tags field)
    @Query("SELECT n FROM OfflineNote n WHERE n.isDeleted = false AND " +
           "LOWER(n.tags) LIKE LOWER(CONCAT('%', :tag, '%')) " +
           "ORDER BY n.updatedAt DESC")
    List<OfflineNote> findByTagContaining(@Param("tag") String tag);

    // Find notes modified after a certain date
    @Query("SELECT n FROM OfflineNote n WHERE n.updatedAt > :since ORDER BY n.updatedAt DESC")
    List<OfflineNote> findModifiedAfter(@Param("since") LocalDateTime since);

    // Count pending sync notes
    @Query("SELECT COUNT(n) FROM OfflineNote n WHERE n.syncStatus = 'PENDING_SYNC' AND n.isDeleted = false")
    long countPendingSyncNotes();

    // Count pending delete notes
    @Query("SELECT COUNT(n) FROM OfflineNote n WHERE n.syncStatus = 'PENDING_DELETE' AND n.isDeleted = true")
    long countPendingDeleteNotes();

    // Find notes by sync status list
    List<OfflineNote> findBySyncStatusIn(List<OfflineNote.SyncStatus> statuses);

    // Find notes that haven't been synced for a while
    @Query("SELECT n FROM OfflineNote n WHERE n.lastSynced IS NULL OR n.lastSynced < :threshold")
    List<OfflineNote> findNotSyncedSince(@Param("threshold") LocalDateTime threshold);

    // Get sync statistics
    @Query("SELECT n.syncStatus, COUNT(n) FROM OfflineNote n WHERE n.isDeleted = false GROUP BY n.syncStatus")
    List<Object[]> getSyncStatistics();

    // Delete notes that are marked for deletion and already synced
    @Query("DELETE FROM OfflineNote n WHERE n.isDeleted = true AND n.syncStatus = 'SYNCED'")
    void cleanupDeletedSyncedNotes();
}

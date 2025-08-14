package com.modulo.repository;

import com.modulo.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    List<Attachment> findByNoteIdAndIsActiveTrue(Long noteId);

    List<Attachment> findByUploadedBy(String uploadedBy);

    Optional<Attachment> findByBlobName(String blobName);

    @Query("SELECT a FROM Attachment a WHERE a.note.id = :noteId AND a.originalFilename LIKE %:filename% AND a.isActive = true")
    List<Attachment> findByNoteIdAndFilenameContaining(@Param("noteId") Long noteId, @Param("filename") String filename);

    @Query("SELECT a FROM Attachment a WHERE a.contentType = :contentType AND a.isActive = true")
    List<Attachment> findByContentType(@Param("contentType") String contentType);

    @Query("SELECT SUM(a.fileSize) FROM Attachment a WHERE a.uploadedBy = :uploadedBy AND a.isActive = true")
    Long getTotalFileSizeByUser(@Param("uploadedBy") String uploadedBy);
}

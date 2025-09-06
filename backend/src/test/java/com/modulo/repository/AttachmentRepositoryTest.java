package com.modulo.repository;

import com.modulo.entity.Attachment;
import com.modulo.entity.Note;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Nested;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest
@TestPropertySource(locations = "classpath:application-test.properties")
@DisplayName("Attachment Repository Tests")
class AttachmentRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private AttachmentRepository attachmentRepository;

    @Autowired
    private NoteRepository noteRepository;

    private Note testNote1;
    private Note testNote2;
    private Attachment attachment1;
    private Attachment attachment2;
    private Attachment attachment3;
    private Attachment inactiveAttachment;

    @BeforeEach
    void setUp() {
        // Create test notes
        testNote1 = new Note();
        testNote1.setTitle("Test Note 1");
        testNote1.setContent("Content for note 1");
        testNote1.setUserId(1L);
        testNote1.setCreatedAt(LocalDateTime.now());
        testNote1.setUpdatedAt(LocalDateTime.now());

        testNote2 = new Note();
        testNote2.setTitle("Test Note 2");
        testNote2.setContent("Content for note 2");
        testNote2.setUserId(2L);
        testNote2.setCreatedAt(LocalDateTime.now());
        testNote2.setUpdatedAt(LocalDateTime.now());

        entityManager.persist(testNote1);
        entityManager.persist(testNote2);

        // Create test attachments
        attachment1 = new Attachment();
        attachment1.setNote(testNote1);
        attachment1.setOriginalFilename("document1.pdf");
        attachment1.setBlobName("blob-123-document1.pdf");
        attachment1.setContentType("application/pdf");
        attachment1.setFileSize(1024000L); // 1MB
        attachment1.setUploadedBy("user1@example.com");
        attachment1.setIsActive(true);
        attachment1.setUploadedAt(LocalDateTime.now());

        attachment2 = new Attachment();
        attachment2.setNote(testNote1);
        attachment2.setOriginalFilename("image1.jpg");
        attachment2.setBlobName("blob-456-image1.jpg");
        attachment2.setContentType("image/jpeg");
        attachment2.setFileSize(512000L); // 512KB
        attachment2.setUploadedBy("user1@example.com");
        attachment2.setIsActive(true);
        attachment2.setUploadedAt(LocalDateTime.now());

        attachment3 = new Attachment();
        attachment3.setNote(testNote2);
        attachment3.setOriginalFilename("spreadsheet1.xlsx");
        attachment3.setBlobName("blob-789-spreadsheet1.xlsx");
        attachment3.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        attachment3.setFileSize(256000L); // 256KB
        attachment3.setUploadedBy("user2@example.com");
        attachment3.setIsActive(true);
        attachment3.setUploadedAt(LocalDateTime.now());

        // Create inactive attachment
        inactiveAttachment = new Attachment();
        inactiveAttachment.setNote(testNote1);
        inactiveAttachment.setOriginalFilename("deleted_file.txt");
        inactiveAttachment.setBlobName("blob-999-deleted.txt");
        inactiveAttachment.setContentType("text/plain");
        inactiveAttachment.setFileSize(1024L);
        inactiveAttachment.setUploadedBy("user1@example.com");
        inactiveAttachment.setIsActive(false);
        inactiveAttachment.setUploadedAt(LocalDateTime.now().minusDays(1));

        entityManager.persist(attachment1);
        entityManager.persist(attachment2);
        entityManager.persist(attachment3);
        entityManager.persist(inactiveAttachment);
        entityManager.flush();
    }

    @Nested
    @DisplayName("Basic CRUD Operations")
    class BasicCrudOperations {

        @Test
        @DisplayName("Should save and find attachment by ID")
        void shouldSaveAndFindAttachmentById() {
            Attachment newAttachment = new Attachment();
            newAttachment.setNote(testNote2);
            newAttachment.setOriginalFilename("newfile.txt");
            newAttachment.setBlobName("blob-new-file.txt");
            newAttachment.setContentType("text/plain");
            newAttachment.setFileSize(2048L);
            newAttachment.setUploadedBy("newuser@example.com");
            newAttachment.setIsActive(true);
            newAttachment.setUploadedAt(LocalDateTime.now());

            Attachment savedAttachment = attachmentRepository.save(newAttachment);
            
            assertThat(savedAttachment.getId()).isNotNull();
            
            Optional<Attachment> foundAttachment = attachmentRepository.findById(savedAttachment.getId());
            
            assertThat(foundAttachment).isPresent();
            assertThat(foundAttachment.get().getOriginalFilename()).isEqualTo("newfile.txt");
            assertThat(foundAttachment.get().getBlobName()).isEqualTo("blob-new-file.txt");
            assertThat(foundAttachment.get().getUploadedBy()).isEqualTo("newuser@example.com");
        }

        @Test
        @DisplayName("Should update existing attachment")
        void shouldUpdateExistingAttachment() {
            attachment1.setOriginalFilename("updated_document.pdf");
            attachment1.setContentType("application/pdf");

            Attachment updatedAttachment = attachmentRepository.save(attachment1);
            
            assertThat(updatedAttachment.getOriginalFilename()).isEqualTo("updated_document.pdf");
            assertThat(updatedAttachment.getBlobName()).isEqualTo("blob-123-document1.pdf"); // Should remain unchanged
        }

        @Test
        @DisplayName("Should delete attachment")
        void shouldDeleteAttachment() {
            Long attachmentId = attachment1.getId();
            
            attachmentRepository.delete(attachment1);
            entityManager.flush();
            
            Optional<Attachment> deletedAttachment = attachmentRepository.findById(attachmentId);
            assertThat(deletedAttachment).isEmpty();
        }

        @Test
        @DisplayName("Should check if attachment exists")
        void shouldCheckIfAttachmentExists() {
            assertThat(attachmentRepository.existsById(attachment1.getId())).isTrue();
            assertThat(attachmentRepository.existsById(999L)).isFalse();
        }

        @Test
        @DisplayName("Should find all attachments")
        void shouldFindAllAttachments() {
            List<Attachment> allAttachments = attachmentRepository.findAll();
            
            assertThat(allAttachments).hasSize(4); // Including inactive attachment
            assertThat(allAttachments).extracting(Attachment::getOriginalFilename)
                .containsExactlyInAnyOrder("document1.pdf", "image1.jpg", "spreadsheet1.xlsx", "deleted_file.txt");
        }

        @Test
        @DisplayName("Should count all attachments")
        void shouldCountAllAttachments() {
            long count = attachmentRepository.count();
            assertThat(count).isEqualTo(4);
        }
    }

    @Nested
    @DisplayName("Note-Based Queries")
    class NoteBasedQueries {

        @Test
        @DisplayName("Should find active attachments by note ID")
        void shouldFindActiveAttachmentsByNoteId() {
            List<Attachment> attachments = attachmentRepository.findByNoteIdAndIsActiveTrue(testNote1.getId());
            
            assertThat(attachments).hasSize(2); // Only active attachments
            assertThat(attachments).extracting(Attachment::getOriginalFilename)
                .containsExactlyInAnyOrder("document1.pdf", "image1.jpg");
        }

        @Test
        @DisplayName("Should not include inactive attachments in note query")
        void shouldNotIncludeInactiveAttachmentsInNoteQuery() {
            List<Attachment> attachments = attachmentRepository.findByNoteIdAndIsActiveTrue(testNote1.getId());
            
            assertThat(attachments).noneMatch(att -> !att.getIsActive());
            assertThat(attachments).noneMatch(att -> "deleted_file.txt".equals(att.getOriginalFilename()));
        }

        @Test
        @DisplayName("Should return empty list for note with no active attachments")
        void shouldReturnEmptyListForNoteWithNoActiveAttachments() {
            Note noteWithoutAttachments = new Note();
            noteWithoutAttachments.setTitle("Empty Note");
            noteWithoutAttachments.setContent("No attachments");
            noteWithoutAttachments.setUserId(3L);
            noteWithoutAttachments.setCreatedAt(LocalDateTime.now());
            noteWithoutAttachments.setUpdatedAt(LocalDateTime.now());
            
            entityManager.persist(noteWithoutAttachments);
            entityManager.flush();
            
            List<Attachment> attachments = attachmentRepository.findByNoteIdAndIsActiveTrue(noteWithoutAttachments.getId());
            
            assertThat(attachments).isEmpty();
        }

        @Test
        @DisplayName("Should find attachments by filename containing pattern")
        void shouldFindAttachmentsByFilenameContainingPattern() {
            List<Attachment> pdfAttachments = attachmentRepository.findByNoteIdAndFilenameContaining(
                testNote1.getId(), "document");
            
            assertThat(pdfAttachments).hasSize(1);
            assertThat(pdfAttachments.get(0).getOriginalFilename()).isEqualTo("document1.pdf");
        }

        @Test
        @DisplayName("Should find attachments by partial filename case insensitive")
        void shouldFindAttachmentsByPartialFilenameCaseInsensitive() {
            List<Attachment> attachments = attachmentRepository.findByNoteIdAndFilenameContaining(
                testNote1.getId(), "IMAGE");
            
            assertThat(attachments).hasSize(1);
            assertThat(attachments.get(0).getOriginalFilename()).isEqualTo("image1.jpg");
        }

        @Test
        @DisplayName("Should return empty list for non-matching filename pattern")
        void shouldReturnEmptyListForNonMatchingFilenamePattern() {
            List<Attachment> attachments = attachmentRepository.findByNoteIdAndFilenameContaining(
                testNote1.getId(), "nonexistent");
            
            assertThat(attachments).isEmpty();
        }
    }

    @Nested
    @DisplayName("User-Based Queries")
    class UserBasedQueries {

        @Test
        @DisplayName("Should find attachments by uploaded user")
        void shouldFindAttachmentsByUploadedUser() {
            List<Attachment> user1Attachments = attachmentRepository.findByUploadedBy("user1@example.com");
            
            assertThat(user1Attachments).hasSize(3); // Including inactive attachment
            assertThat(user1Attachments).extracting(Attachment::getOriginalFilename)
                .containsExactlyInAnyOrder("document1.pdf", "image1.jpg", "deleted_file.txt");
        }

        @Test
        @DisplayName("Should find attachments by different users")
        void shouldFindAttachmentsByDifferentUsers() {
            List<Attachment> user2Attachments = attachmentRepository.findByUploadedBy("user2@example.com");
            
            assertThat(user2Attachments).hasSize(1);
            assertThat(user2Attachments.get(0).getOriginalFilename()).isEqualTo("spreadsheet1.xlsx");
        }

        @Test
        @DisplayName("Should return empty list for user with no attachments")
        void shouldReturnEmptyListForUserWithNoAttachments() {
            List<Attachment> attachments = attachmentRepository.findByUploadedBy("nonexistentuser@example.com");
            
            assertThat(attachments).isEmpty();
        }

        @Test
        @DisplayName("Should calculate total file size by user")
        void shouldCalculateTotalFileSizeByUser() {
            Long totalSize = attachmentRepository.getTotalFileSizeByUser("user1@example.com");
            
            // Only active attachments should count: 1024000 + 512000 = 1536000
            assertThat(totalSize).isEqualTo(1536000L);
        }

        @Test
        @DisplayName("Should calculate total file size excluding inactive attachments")
        void shouldCalculateTotalFileSizeExcludingInactiveAttachments() {
            Long totalSize = attachmentRepository.getTotalFileSizeByUser("user1@example.com");
            
            // Should not include inactive attachment size (1024)
            assertThat(totalSize).isNotEqualTo(1537024L); // 1536000 + 1024
            assertThat(totalSize).isEqualTo(1536000L);
        }

        @Test
        @DisplayName("Should return 0 for user with no active attachments")
        void shouldReturnZeroForUserWithNoActiveAttachments() {
            Long totalSize = attachmentRepository.getTotalFileSizeByUser("nonexistentuser@example.com");
            
            assertThat(totalSize).isNull(); // SUM returns null for empty result set
        }

        @Test
        @DisplayName("Should handle user with only inactive attachments")
        void shouldHandleUserWithOnlyInactiveAttachments() {
            // Create a user with only inactive attachments
            Attachment inactiveOnly = new Attachment();
            inactiveOnly.setNote(testNote2);
            inactiveOnly.setOriginalFilename("inactive.txt");
            inactiveOnly.setBlobName("blob-inactive.txt");
            inactiveOnly.setContentType("text/plain");
            inactiveOnly.setFileSize(2048L);
            inactiveOnly.setUploadedBy("inactiveuser@example.com");
            inactiveOnly.setIsActive(false);
            inactiveOnly.setUploadedAt(LocalDateTime.now());
            
            entityManager.persist(inactiveOnly);
            entityManager.flush();

            Long totalSize = attachmentRepository.getTotalFileSizeByUser("inactiveuser@example.com");
            
            assertThat(totalSize).isNull(); // No active attachments
        }
    }

    @Nested
    @DisplayName("Content Type Queries")
    class ContentTypeQueries {

        @Test
        @DisplayName("Should find attachments by content type")
        void shouldFindAttachmentsByContentType() {
            List<Attachment> pdfAttachments = attachmentRepository.findByContentType("application/pdf");
            
            assertThat(pdfAttachments).hasSize(1);
            assertThat(pdfAttachments.get(0).getOriginalFilename()).isEqualTo("document1.pdf");
        }

        @Test
        @DisplayName("Should find image attachments")
        void shouldFindImageAttachments() {
            List<Attachment> imageAttachments = attachmentRepository.findByContentType("image/jpeg");
            
            assertThat(imageAttachments).hasSize(1);
            assertThat(imageAttachments.get(0).getOriginalFilename()).isEqualTo("image1.jpg");
        }

        @Test
        @DisplayName("Should find Excel attachments")
        void shouldFindExcelAttachments() {
            List<Attachment> excelAttachments = attachmentRepository.findByContentType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            
            assertThat(excelAttachments).hasSize(1);
            assertThat(excelAttachments.get(0).getOriginalFilename()).isEqualTo("spreadsheet1.xlsx");
        }

        @Test
        @DisplayName("Should only return active attachments by content type")
        void shouldOnlyReturnActiveAttachmentsByContentType() {
            List<Attachment> textAttachments = attachmentRepository.findByContentType("text/plain");
            
            assertThat(textAttachments).isEmpty(); // Inactive attachment should not be returned
        }

        @Test
        @DisplayName("Should return empty list for non-existent content type")
        void shouldReturnEmptyListForNonExistentContentType() {
            List<Attachment> attachments = attachmentRepository.findByContentType("application/nonexistent");
            
            assertThat(attachments).isEmpty();
        }

        @Test
        @DisplayName("Should handle content type case sensitivity")
        void shouldHandleContentTypeCaseSensitivity() {
            List<Attachment> attachments = attachmentRepository.findByContentType("APPLICATION/PDF");
            
            // Assuming case-sensitive search
            assertThat(attachments).isEmpty();
        }
    }

    @Nested
    @DisplayName("Blob Name Queries")
    class BlobNameQueries {

        @Test
        @DisplayName("Should find attachment by blob name")
        void shouldFindAttachmentByBlobName() {
            Optional<Attachment> attachment = attachmentRepository.findByBlobName("blob-123-document1.pdf");
            
            assertThat(attachment).isPresent();
            assertThat(attachment.get().getOriginalFilename()).isEqualTo("document1.pdf");
        }

        @Test
        @DisplayName("Should find different attachments by different blob names")
        void shouldFindDifferentAttachmentsByDifferentBlobNames() {
            Optional<Attachment> attachment1 = attachmentRepository.findByBlobName("blob-456-image1.jpg");
            Optional<Attachment> attachment2 = attachmentRepository.findByBlobName("blob-789-spreadsheet1.xlsx");
            
            assertThat(attachment1).isPresent();
            assertThat(attachment1.get().getContentType()).isEqualTo("image/jpeg");
            
            assertThat(attachment2).isPresent();
            assertThat(attachment2.get().getContentType()).isEqualTo("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        }

        @Test
        @DisplayName("Should find inactive attachment by blob name")
        void shouldFindInactiveAttachmentByBlobName() {
            Optional<Attachment> attachment = attachmentRepository.findByBlobName("blob-999-deleted.txt");
            
            assertThat(attachment).isPresent();
            assertThat(attachment.get().getIsActive()).isFalse();
        }

        @Test
        @DisplayName("Should return empty for non-existent blob name")
        void shouldReturnEmptyForNonExistentBlobName() {
            Optional<Attachment> attachment = attachmentRepository.findByBlobName("non-existent-blob");
            
            assertThat(attachment).isEmpty();
        }

        @Test
        @DisplayName("Should handle blob name case sensitivity")
        void shouldHandleBlobNameCaseSensitivity() {
            Optional<Attachment> attachment = attachmentRepository.findByBlobName("BLOB-123-DOCUMENT1.PDF");
            
            // Assuming case-sensitive search
            assertThat(attachment).isEmpty();
        }
    }

    @Nested
    @DisplayName("Data Integrity and Constraints")
    class DataIntegrityAndConstraints {

        @Test
        @DisplayName("Should enforce unique blob name constraint")
        void shouldEnforceUniqueBlobNameConstraint() {
            Attachment duplicateBlobAttachment = new Attachment();
            duplicateBlobAttachment.setNote(testNote2);
            duplicateBlobAttachment.setOriginalFilename("duplicate.txt");
            duplicateBlobAttachment.setBlobName("blob-123-document1.pdf"); // Same as existing
            duplicateBlobAttachment.setContentType("text/plain");
            duplicateBlobAttachment.setFileSize(1024L);
            duplicateBlobAttachment.setUploadedBy("user@example.com");
            duplicateBlobAttachment.setIsActive(true);
            duplicateBlobAttachment.setUploadedAt(LocalDateTime.now());

            assertThatThrownBy(() -> {
                attachmentRepository.save(duplicateBlobAttachment);
                entityManager.flush();
            }).isInstanceOf(Exception.class); // DataIntegrityViolationException or similar
        }

        @Test
        @DisplayName("Should handle null values appropriately")
        void shouldHandleNullValuesAppropriately() {
            Attachment attachmentWithNulls = new Attachment();
            attachmentWithNulls.setNote(testNote1);
            attachmentWithNulls.setOriginalFilename("nulltest.txt");
            attachmentWithNulls.setBlobName("blob-null-test.txt");
            attachmentWithNulls.setFileSize(0L);
            attachmentWithNulls.setUploadedBy("nulluser@example.com");
            attachmentWithNulls.setIsActive(true);
            attachmentWithNulls.setUploadedAt(LocalDateTime.now());
            // contentType is null

            Attachment savedAttachment = attachmentRepository.save(attachmentWithNulls);
            
            assertThat(savedAttachment.getId()).isNotNull();
            assertThat(savedAttachment.getContentType()).isNull();
        }

        @Test
        @DisplayName("Should handle very large file sizes")
        void shouldHandleVeryLargeFileSizes() {
            Attachment largeFileAttachment = new Attachment();
            largeFileAttachment.setNote(testNote1);
            largeFileAttachment.setOriginalFilename("largefile.zip");
            largeFileAttachment.setBlobName("blob-large-file.zip");
            largeFileAttachment.setContentType("application/zip");
            largeFileAttachment.setFileSize(Long.MAX_VALUE);
            largeFileAttachment.setUploadedBy("user@example.com");
            largeFileAttachment.setIsActive(true);
            largeFileAttachment.setUploadedAt(LocalDateTime.now());

            Attachment savedAttachment = attachmentRepository.save(largeFileAttachment);
            
            assertThat(savedAttachment.getId()).isNotNull();
            assertThat(savedAttachment.getFileSize()).isEqualTo(Long.MAX_VALUE);
        }

        @Test
        @DisplayName("Should handle special characters in filenames")
        void shouldHandleSpecialCharactersInFilenames() {
            Attachment specialCharAttachment = new Attachment();
            specialCharAttachment.setNote(testNote1);
            specialCharAttachment.setOriginalFilename("файл тест 测试 🌟.txt");
            specialCharAttachment.setBlobName("blob-special-chars-file.txt");
            specialCharAttachment.setContentType("text/plain");
            specialCharAttachment.setFileSize(1024L);
            specialCharAttachment.setUploadedBy("specialuser@example.com");
            specialCharAttachment.setIsActive(true);
            specialCharAttachment.setUploadedAt(LocalDateTime.now());

            Attachment savedAttachment = attachmentRepository.save(specialCharAttachment);
            
            assertThat(savedAttachment.getId()).isNotNull();
            assertThat(savedAttachment.getOriginalFilename()).isEqualTo("файл тест 测试 🌟.txt");
        }
    }

    @Nested
    @DisplayName("Performance and Edge Cases")
    class PerformanceAndEdgeCases {

        @Test
        @DisplayName("Should handle large number of attachments")
        void shouldHandleLargeNumberOfAttachments() {
            // Create many attachments for performance testing
            for (int i = 0; i < 100; i++) {
                Attachment attachment = new Attachment();
                attachment.setNote(testNote1);
                attachment.setOriginalFilename("perf_file_" + i + ".txt");
                attachment.setBlobName("blob-perf-" + i + ".txt");
                attachment.setContentType("text/plain");
                attachment.setFileSize(1024L * i);
                attachment.setUploadedBy("perfuser@example.com");
                attachment.setIsActive(i % 2 == 0); // Half active, half inactive
                attachment.setUploadedAt(LocalDateTime.now().minusMinutes(i));
                entityManager.persist(attachment);
            }
            entityManager.flush();

            List<Attachment> allAttachments = attachmentRepository.findAll();
            List<Attachment> activeAttachments = attachmentRepository.findByNoteIdAndIsActiveTrue(testNote1.getId());
            Long totalSize = attachmentRepository.getTotalFileSizeByUser("perfuser@example.com");
            
            assertThat(allAttachments).hasSizeGreaterThanOrEqualTo(100);
            assertThat(activeAttachments).hasSizeGreaterThan(50); // Original 2 + ~50 new active
            assertThat(totalSize).isNotNull().isPositive();
        }

        @Test
        @DisplayName("Should handle empty result sets efficiently")
        void shouldHandleEmptyResultSetsEfficiently() {
            // Test with non-existent note ID
            List<Attachment> attachments = attachmentRepository.findByNoteIdAndIsActiveTrue(999L);
            assertThat(attachments).isEmpty();

            // Test with non-existent user
            List<Attachment> userAttachments = attachmentRepository.findByUploadedBy("nonexistent@example.com");
            assertThat(userAttachments).isEmpty();

            // Test with non-existent content type
            List<Attachment> contentTypeAttachments = attachmentRepository.findByContentType("nonexistent/type");
            assertThat(contentTypeAttachments).isEmpty();

            // Test with non-existent blob name
            Optional<Attachment> blobAttachment = attachmentRepository.findByBlobName("nonexistent-blob");
            assertThat(blobAttachment).isEmpty();
        }

        @Test
        @DisplayName("Should handle batch operations")
        void shouldHandleBatchOperations() {
            // Create multiple attachments for batch testing
            Attachment batch1 = new Attachment();
            batch1.setNote(testNote2);
            batch1.setOriginalFilename("batch1.txt");
            batch1.setBlobName("blob-batch-1.txt");
            batch1.setContentType("text/plain");
            batch1.setFileSize(1024L);
            batch1.setUploadedBy("batchuser@example.com");
            batch1.setIsActive(true);
            batch1.setUploadedAt(LocalDateTime.now());

            Attachment batch2 = new Attachment();
            batch2.setNote(testNote2);
            batch2.setOriginalFilename("batch2.txt");
            batch2.setBlobName("blob-batch-2.txt");
            batch2.setContentType("text/plain");
            batch2.setFileSize(2048L);
            batch2.setUploadedBy("batchuser@example.com");
            batch2.setIsActive(true);
            batch2.setUploadedAt(LocalDateTime.now());

            List<Attachment> batchAttachments = List.of(batch1, batch2);
            List<Attachment> savedAttachments = attachmentRepository.saveAll(batchAttachments);
            
            assertThat(savedAttachments).hasSize(2);
            assertThat(savedAttachments).allMatch(att -> att.getId() != null);
        }
    }

    @Nested
    @DisplayName("Complex Query Scenarios")
    class ComplexQueryScenarios {

        @Test
        @DisplayName("Should handle mixed active and inactive attachments correctly")
        void shouldHandleMixedActiveAndInactiveAttachmentsCorrectly() {
            // Verify the setup has both active and inactive attachments
            List<Attachment> allForNote1 = attachmentRepository.findAll().stream()
                .filter(att -> att.getNote().getId().equals(testNote1.getId()))
                .toList();
            
            assertThat(allForNote1).hasSize(3); // 2 active + 1 inactive

            List<Attachment> activeForNote1 = attachmentRepository.findByNoteIdAndIsActiveTrue(testNote1.getId());
            assertThat(activeForNote1).hasSize(2); // Only active ones
        }

        @Test
        @DisplayName("Should handle attachment state transitions")
        void shouldHandleAttachmentStateTransitions() {
            // Make active attachment inactive
            attachment1.setIsActive(false);
            attachmentRepository.save(attachment1);
            entityManager.flush();

            List<Attachment> activeAttachments = attachmentRepository.findByNoteIdAndIsActiveTrue(testNote1.getId());
            assertThat(activeAttachments).hasSize(1); // One less active attachment

            // Make inactive attachment active
            inactiveAttachment.setIsActive(true);
            attachmentRepository.save(inactiveAttachment);
            entityManager.flush();

            activeAttachments = attachmentRepository.findByNoteIdAndIsActiveTrue(testNote1.getId());
            assertThat(activeAttachments).hasSize(2); // Back to 2 active attachments
        }

        @Test
        @DisplayName("Should handle complex filename searches")
        void shouldHandleComplexFilenameSearches() {
            // Create attachments with various filename patterns
            Attachment versionedFile = new Attachment();
            versionedFile.setNote(testNote1);
            versionedFile.setOriginalFilename("document_v1.2.pdf");
            versionedFile.setBlobName("blob-versioned.pdf");
            versionedFile.setContentType("application/pdf");
            versionedFile.setFileSize(1024L);
            versionedFile.setUploadedBy("user@example.com");
            versionedFile.setIsActive(true);
            versionedFile.setUploadedAt(LocalDateTime.now());

            entityManager.persist(versionedFile);
            entityManager.flush();

            // Search for various patterns
            List<Attachment> docFiles = attachmentRepository.findByNoteIdAndFilenameContaining(
                testNote1.getId(), "document");
            assertThat(docFiles).hasSize(2); // document1.pdf and document_v1.2.pdf

            List<Attachment> versionedFiles = attachmentRepository.findByNoteIdAndFilenameContaining(
                testNote1.getId(), "v1");
            assertThat(versionedFiles).hasSize(1);

            List<Attachment> pdfFiles = attachmentRepository.findByNoteIdAndFilenameContaining(
                testNote1.getId(), ".pdf");
            assertThat(pdfFiles).hasSize(2);
        }
    }
}

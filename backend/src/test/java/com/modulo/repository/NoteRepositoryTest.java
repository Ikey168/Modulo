package com.modulo.repository;

import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Nested;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest
@TestPropertySource(locations = "classpath:application-test.properties")
@DisplayName("Note Repository Tests")
class NoteRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private TagRepository tagRepository;

    private Note testNote1;
    private Note testNote2;
    private Tag testTag1;
    private Tag testTag2;

    @BeforeEach
    void setUp() {
        // Create test tags
        testTag1 = new Tag("Important", "red");
        testTag2 = new Tag("Work", "blue");
        
        entityManager.persist(testTag1);
        entityManager.persist(testTag2);
        
        // Create test notes
        testNote1 = new Note();
        testNote1.setTitle("Test Note 1");
        testNote1.setContent("This is test content for note 1");
        testNote1.setMarkdownContent("# Test Note 1\n\nThis is test content for note 1");
        testNote1.setUserId(1L);
        testNote1.setCreatedAt(LocalDateTime.now());
        testNote1.setUpdatedAt(LocalDateTime.now());
        
        testNote2 = new Note();
        testNote2.setTitle("Another Test Note");
        testNote2.setContent("This is different content for searching");
        testNote2.setMarkdownContent("# Another Test Note\n\nThis is different content for searching");
        testNote2.setUserId(2L);
        testNote2.setCreatedAt(LocalDateTime.now());
        testNote2.setUpdatedAt(LocalDateTime.now());
        
        entityManager.persist(testNote1);
        entityManager.persist(testNote2);
        
        // Add tags to notes
        testNote1.getTags().add(testTag1);
        testNote2.getTags().add(testTag2);
        
        entityManager.flush();
    }

    @Nested
    @DisplayName("Basic CRUD Operations")
    class BasicCrudOperations {

        @Test
        @DisplayName("Should save and find note by ID")
        void shouldSaveAndFindNoteById() {
            Note newNote = new Note();
            newNote.setTitle("New Test Note");
            newNote.setContent("New test content");
            newNote.setUserId(3L);
            newNote.setCreatedAt(LocalDateTime.now());
            newNote.setUpdatedAt(LocalDateTime.now());

            Note savedNote = noteRepository.save(newNote);
            
            assertThat(savedNote.getId()).isNotNull();
            
            Optional<Note> foundNote = noteRepository.findById(savedNote.getId());
            
            assertThat(foundNote).isPresent();
            assertThat(foundNote.get().getTitle()).isEqualTo("New Test Note");
            assertThat(foundNote.get().getContent()).isEqualTo("New test content");
            assertThat(foundNote.get().getUserId()).isEqualTo(3L);
        }

        @Test
        @DisplayName("Should update existing note")
        void shouldUpdateExistingNote() {
            testNote1.setTitle("Updated Title");
            testNote1.setContent("Updated Content");
            testNote1.setUpdatedAt(LocalDateTime.now());

            Note updatedNote = noteRepository.save(testNote1);
            
            assertThat(updatedNote.getTitle()).isEqualTo("Updated Title");
            assertThat(updatedNote.getContent()).isEqualTo("Updated Content");
        }

        @Test
        @DisplayName("Should delete note")
        void shouldDeleteNote() {
            Long noteId = testNote1.getId();
            
            noteRepository.delete(testNote1);
            entityManager.flush();
            
            Optional<Note> deletedNote = noteRepository.findById(noteId);
            assertThat(deletedNote).isEmpty();
        }

        @Test
        @DisplayName("Should check if note exists")
        void shouldCheckIfNoteExists() {
            assertThat(noteRepository.existsById(testNote1.getId())).isTrue();
            assertThat(noteRepository.existsById(999L)).isFalse();
        }

        @Test
        @DisplayName("Should find all notes")
        void shouldFindAllNotes() {
            List<Note> allNotes = noteRepository.findAll();
            
            assertThat(allNotes).hasSize(2);
            assertThat(allNotes).extracting(Note::getTitle)
                .containsExactlyInAnyOrder("Test Note 1", "Another Test Note");
        }

        @Test
        @DisplayName("Should save all notes in batch")
        void shouldSaveAllNotesInBatch() {
            Note note3 = new Note();
            note3.setTitle("Batch Note 1");
            note3.setContent("Batch content 1");
            note3.setUserId(4L);
            note3.setCreatedAt(LocalDateTime.now());
            note3.setUpdatedAt(LocalDateTime.now());

            Note note4 = new Note();
            note4.setTitle("Batch Note 2");
            note4.setContent("Batch content 2");
            note4.setUserId(5L);
            note4.setCreatedAt(LocalDateTime.now());
            note4.setUpdatedAt(LocalDateTime.now());

            List<Note> batchNotes = List.of(note3, note4);
            List<Note> savedNotes = noteRepository.saveAll(batchNotes);
            
            assertThat(savedNotes).hasSize(2);
            assertThat(savedNotes).allMatch(note -> note.getId() != null);
        }

        @Test
        @DisplayName("Should count all notes")
        void shouldCountAllNotes() {
            long count = noteRepository.count();
            assertThat(count).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("Custom Query Methods")
    class CustomQueryMethods {

        @Test
        @DisplayName("Should find notes by tag")
        void shouldFindNotesByTag() {
            List<Note> notesWithTag1 = noteRepository.findByTag(testTag1);
            
            assertThat(notesWithTag1).hasSize(1);
            assertThat(notesWithTag1.get(0).getTitle()).isEqualTo("Test Note 1");
        }

        @Test
        @DisplayName("Should find notes by tag name")
        void shouldFindNotesByTagName() {
            List<Note> notesWithWorkTag = noteRepository.findByTagName("Work");
            
            assertThat(notesWithWorkTag).hasSize(1);
            assertThat(notesWithWorkTag.get(0).getTitle()).isEqualTo("Another Test Note");
        }

        @Test
        @DisplayName("Should find notes by tag name case insensitive")
        void shouldFindNotesByTagNameCaseInsensitive() {
            List<Note> notesWithWorkTag = noteRepository.findByTagName("work");
            
            // Should still find the note even with different case
            assertThat(notesWithWorkTag).hasSize(1);
            assertThat(notesWithWorkTag.get(0).getTitle()).isEqualTo("Another Test Note");
        }

        @Test
        @DisplayName("Should find notes by title content search")
        void shouldFindNotesByTitleContentSearch() {
            List<Note> notesWithTest = noteRepository.findByTitleOrContentContainingIgnoreCase("test");
            
            assertThat(notesWithTest).hasSize(2);
        }

        @Test
        @DisplayName("Should find notes by content search")
        void shouldFindNotesByContentSearch() {
            List<Note> notesWithSearching = noteRepository.findByTitleOrContentContainingIgnoreCase("searching");
            
            assertThat(notesWithSearching).hasSize(1);
            assertThat(notesWithSearching.get(0).getTitle()).isEqualTo("Another Test Note");
        }

        @Test
        @DisplayName("Should find notes by partial search case insensitive")
        void shouldFindNotesByPartialSearchCaseInsensitive() {
            List<Note> notesWithContent = noteRepository.findByTitleOrContentContainingIgnoreCase("CONTENT");
            
            assertThat(notesWithContent).hasSize(2);
        }

        @Test
        @DisplayName("Should find all notes with tags")
        void shouldFindAllNotesWithTags() {
            List<Note> notesWithTags = noteRepository.findAllWithTags();
            
            assertThat(notesWithTags).hasSize(2);
            
            // Verify tags are eagerly loaded
            for (Note note : notesWithTags) {
                assertThat(note.getTags()).isNotEmpty();
            }
        }

        @Test
        @DisplayName("Should return empty list for non-existent tag")
        void shouldReturnEmptyListForNonExistentTag() {
            Tag nonExistentTag = new Tag("NonExistent", "gray");
            List<Note> notes = noteRepository.findByTag(nonExistentTag);
            
            assertThat(notes).isEmpty();
        }

        @Test
        @DisplayName("Should return empty list for non-existent tag name")
        void shouldReturnEmptyListForNonExistentTagName() {
            List<Note> notes = noteRepository.findByTagName("NonExistentTag");
            
            assertThat(notes).isEmpty();
        }

        @Test
        @DisplayName("Should return empty list for non-matching search")
        void shouldReturnEmptyListForNonMatchingSearch() {
            List<Note> notes = noteRepository.findByTitleOrContentContainingIgnoreCase("xyz123nonexistent");
            
            assertThat(notes).isEmpty();
        }
    }

    @Nested
    @DisplayName("Data Integrity and Constraints")
    class DataIntegrityAndConstraints {

        @Test
        @DisplayName("Should handle null values appropriately")
        void shouldHandleNullValuesAppropriately() {
            Note noteWithNulls = new Note();
            noteWithNulls.setUserId(6L);
            noteWithNulls.setCreatedAt(LocalDateTime.now());
            noteWithNulls.setUpdatedAt(LocalDateTime.now());
            // title and content are null

            Note savedNote = noteRepository.save(noteWithNulls);
            
            assertThat(savedNote.getId()).isNotNull();
            assertThat(savedNote.getTitle()).isNull();
            assertThat(savedNote.getContent()).isNull();
            assertThat(savedNote.getUserId()).isEqualTo(6L);
        }

        @Test
        @DisplayName("Should handle very long content")
        void shouldHandleVeryLongContent() {
            Note noteWithLongContent = new Note();
            noteWithLongContent.setTitle("Long Content Note");
            
            // Create a very long content string
            StringBuilder longContent = new StringBuilder();
            for (int i = 0; i < 10000; i++) {
                longContent.append("This is line ").append(i).append(" of very long content. ");
            }
            noteWithLongContent.setContent(longContent.toString());
            noteWithLongContent.setUserId(7L);
            noteWithLongContent.setCreatedAt(LocalDateTime.now());
            noteWithLongContent.setUpdatedAt(LocalDateTime.now());

            Note savedNote = noteRepository.save(noteWithLongContent);
            
            assertThat(savedNote.getId()).isNotNull();
            assertThat(savedNote.getContent()).hasSize(longContent.length());
        }

        @Test
        @DisplayName("Should handle unicode and special characters")
        void shouldHandleUnicodeAndSpecialCharacters() {
            Note unicodeNote = new Note();
            unicodeNote.setTitle("Unicode Test: 测试 🌟 ñáéíóú");
            unicodeNote.setContent("Special chars: @#$%^&*(){}[]|\\:;\"'<>,.?/~`");
            unicodeNote.setUserId(8L);
            unicodeNote.setCreatedAt(LocalDateTime.now());
            unicodeNote.setUpdatedAt(LocalDateTime.now());

            Note savedNote = noteRepository.save(unicodeNote);
            
            assertThat(savedNote.getId()).isNotNull();
            assertThat(savedNote.getTitle()).isEqualTo("Unicode Test: 测试 🌟 ñáéíóú");
            assertThat(savedNote.getContent()).isEqualTo("Special chars: @#$%^&*(){}[]|\\:;\"'<>,.?/~`");
        }
    }

    @Nested
    @DisplayName("Performance and Edge Cases")
    class PerformanceAndEdgeCases {

        @Test
        @DisplayName("Should handle large result sets")
        void shouldHandleLargeResultSets() {
            // Create many test notes
            for (int i = 0; i < 100; i++) {
                Note note = new Note();
                note.setTitle("Performance Test Note " + i);
                note.setContent("Performance test content " + i);
                note.setUserId((long) (i % 5 + 1)); // Distribute across 5 users
                note.setCreatedAt(LocalDateTime.now());
                note.setUpdatedAt(LocalDateTime.now());
                entityManager.persist(note);
            }
            entityManager.flush();

            List<Note> allNotes = noteRepository.findAll();
            
            assertThat(allNotes).hasSizeGreaterThanOrEqualTo(100);
        }

        @Test
        @DisplayName("Should handle empty database scenario")
        void shouldHandleEmptyDatabaseScenario() {
            // Clear all data
            noteRepository.deleteAll();
            entityManager.flush();

            List<Note> notes = noteRepository.findAll();
            assertThat(notes).isEmpty();

            List<Note> searchResults = noteRepository.findByTitleOrContentContainingIgnoreCase("anything");
            assertThat(searchResults).isEmpty();

            List<Note> notesWithTags = noteRepository.findAllWithTags();
            assertThat(notesWithTags).isEmpty();
        }

        @Test
        @DisplayName("Should handle concurrent access")
        void shouldHandleConcurrentAccess() {
            // Simulate optimistic locking
            Optional<Note> note1 = noteRepository.findById(testNote1.getId());
            Optional<Note> note2 = noteRepository.findById(testNote1.getId());

            assertThat(note1).isPresent();
            assertThat(note2).isPresent();

            // Both instances should have the same version initially
            assertThat(note1.get().getVersion()).isEqualTo(note2.get().getVersion());

            // Update first instance
            note1.get().setTitle("Updated by first thread");
            noteRepository.save(note1.get());
            entityManager.flush();

            // Try to update second instance (this should work in the same transaction)
            note2.get().setTitle("Updated by second thread");
            noteRepository.save(note2.get());
            entityManager.flush();

            // The last update should win
            Optional<Note> finalNote = noteRepository.findById(testNote1.getId());
            assertThat(finalNote).isPresent();
            assertThat(finalNote.get().getTitle()).isEqualTo("Updated by second thread");
        }
    }

    @Nested
    @DisplayName("Relationship Testing")
    class RelationshipTesting {

        @Test
        @DisplayName("Should maintain tag relationships after note update")
        void shouldMaintainTagRelationshipsAfterNoteUpdate() {
            testNote1.setTitle("Updated Title");
            Note updatedNote = noteRepository.save(testNote1);
            entityManager.flush();

            // Tags should still be there
            assertThat(updatedNote.getTags()).hasSize(1);
            assertThat(updatedNote.getTags().iterator().next().getName()).isEqualTo("Important");
        }

        @Test
        @DisplayName("Should handle adding new tags to existing note")
        void shouldHandleAddingNewTagsToExistingNote() {
            Tag newTag = new Tag("Urgent", "orange");
            entityManager.persist(newTag);
            entityManager.flush();

            testNote1.getTags().add(newTag);
            Note updatedNote = noteRepository.save(testNote1);
            entityManager.flush();

            assertThat(updatedNote.getTags()).hasSize(2);
            assertThat(updatedNote.getTags())
                .extracting(Tag::getName)
                .containsExactlyInAnyOrder("Important", "Urgent");
        }

        @Test
        @DisplayName("Should handle removing tags from existing note")
        void shouldHandleRemovingTagsFromExistingNote() {
            testNote1.getTags().clear();
            Note updatedNote = noteRepository.save(testNote1);
            entityManager.flush();

            assertThat(updatedNote.getTags()).isEmpty();
        }

        @Test
        @DisplayName("Should handle orphaned relationships correctly")
        void shouldHandleOrphanedRelationshipsCorrectly() {
            Long noteId = testNote1.getId();
            
            // Delete the note
            noteRepository.delete(testNote1);
            entityManager.flush();

            // Note should be deleted
            assertThat(noteRepository.findById(noteId)).isEmpty();

            // Tag should still exist (assuming no cascade delete)
            assertThat(tagRepository.findById(testTag1.getId())).isPresent();
        }
    }
}

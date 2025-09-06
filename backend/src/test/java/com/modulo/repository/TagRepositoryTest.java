package com.modulo.repository;

import com.modulo.entity.Tag;
import com.modulo.entity.Note;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Nested;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest
@TestPropertySource(locations = "classpath:application-test.properties")
@DisplayName("Tag Repository Tests")
class TagRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private NoteRepository noteRepository;

    private Tag tag1;
    private Tag tag2;
    private Tag tag3;
    private Note note1;
    private Note note2;
    private Note note3;

    @BeforeEach
    void setUp() {
        // Create test tags
        tag1 = new Tag("Important", "red");
        tag2 = new Tag("Work", "blue");
        tag3 = new Tag("Personal", "green");

        entityManager.persist(tag1);
        entityManager.persist(tag2);
        entityManager.persist(tag3);

        // Create test notes
        note1 = new Note();
        note1.setTitle("Work Note 1");
        note1.setContent("This is a work-related note");
        note1.setUserId(1L);
        note1.setCreatedAt(LocalDateTime.now());
        note1.setUpdatedAt(LocalDateTime.now());

        note2 = new Note();
        note2.setTitle("Personal Note");
        note2.setContent("This is a personal note");
        note2.setUserId(2L);
        note2.setCreatedAt(LocalDateTime.now());
        note2.setUpdatedAt(LocalDateTime.now());

        note3 = new Note();
        note3.setTitle("Important Work Task");
        note3.setContent("This is both important and work-related");
        note3.setUserId(1L);
        note3.setCreatedAt(LocalDateTime.now());
        note3.setUpdatedAt(LocalDateTime.now());

        entityManager.persist(note1);
        entityManager.persist(note2);
        entityManager.persist(note3);

        // Associate tags with notes
        note1.getTags().add(tag2); // Work tag
        note2.getTags().add(tag3); // Personal tag
        note3.getTags().add(tag1); // Important tag
        note3.getTags().add(tag2); // Work tag

        entityManager.flush();
    }

    @Nested
    @DisplayName("Basic CRUD Operations")
    class BasicCrudOperations {

        @Test
        @DisplayName("Should save and find tag by ID")
        void shouldSaveAndFindTagById() {
            Tag newTag = new Tag("Urgent", "orange");

            Tag savedTag = tagRepository.save(newTag);
            
            assertThat(savedTag.getId()).isNotNull();
            
            Optional<Tag> foundTag = tagRepository.findById(savedTag.getId());
            
            assertThat(foundTag).isPresent();
            assertThat(foundTag.get().getName()).isEqualTo("Urgent");
            assertThat(foundTag.get().getColor()).isEqualTo("orange");
        }

        @Test
        @DisplayName("Should update existing tag")
        void shouldUpdateExistingTag() {
            tag1.setColor("darkred");

            Tag updatedTag = tagRepository.save(tag1);
            
            assertThat(updatedTag.getColor()).isEqualTo("darkred");
            assertThat(updatedTag.getName()).isEqualTo("Important"); // Name should remain unchanged
        }

        @Test
        @DisplayName("Should delete tag")
        void shouldDeleteTag() {
            UUID tagId = tag1.getId();
            
            tagRepository.delete(tag1);
            entityManager.flush();
            
            Optional<Tag> deletedTag = tagRepository.findById(tagId);
            assertThat(deletedTag).isEmpty();
        }

        @Test
        @DisplayName("Should check if tag exists")
        void shouldCheckIfTagExists() {
            assertThat(tagRepository.existsById(tag1.getId())).isTrue();
            assertThat(tagRepository.existsById(UUID.randomUUID())).isFalse();
        }

        @Test
        @DisplayName("Should find all tags")
        void shouldFindAllTags() {
            List<Tag> allTags = tagRepository.findAll();
            
            assertThat(allTags).hasSize(3);
            assertThat(allTags).extracting(Tag::getName)
                .containsExactlyInAnyOrder("Important", "Work", "Personal");
        }

        @Test
        @DisplayName("Should count all tags")
        void shouldCountAllTags() {
            long count = tagRepository.count();
            assertThat(count).isEqualTo(3);
        }

        @Test
        @DisplayName("Should save all tags in batch")
        void shouldSaveAllTagsInBatch() {
            Tag batchTag1 = new Tag("Meeting", "purple");
            Tag batchTag2 = new Tag("Deadline", "yellow");

            List<Tag> batchTags = List.of(batchTag1, batchTag2);
            List<Tag> savedTags = tagRepository.saveAll(batchTags);
            
            assertThat(savedTags).hasSize(2);
            assertThat(savedTags).allMatch(tag -> tag.getId() != null);
        }
    }

    @Nested
    @DisplayName("Name-Based Queries")
    class NameBasedQueries {

        @Test
        @DisplayName("Should find tag by exact name")
        void shouldFindTagByExactName() {
            Optional<Tag> foundTag = tagRepository.findByName("Important");
            
            assertThat(foundTag).isPresent();
            assertThat(foundTag.get().getColor()).isEqualTo("red");
        }

        @Test
        @DisplayName("Should find different tags by different names")
        void shouldFindDifferentTagsByDifferentNames() {
            Optional<Tag> workTag = tagRepository.findByName("Work");
            Optional<Tag> personalTag = tagRepository.findByName("Personal");
            
            assertThat(workTag).isPresent();
            assertThat(workTag.get().getColor()).isEqualTo("blue");
            
            assertThat(personalTag).isPresent();
            assertThat(personalTag.get().getColor()).isEqualTo("green");
        }

        @Test
        @DisplayName("Should return empty for non-existent tag name")
        void shouldReturnEmptyForNonExistentTagName() {
            Optional<Tag> foundTag = tagRepository.findByName("NonExistent");
            
            assertThat(foundTag).isEmpty();
        }

        @Test
        @DisplayName("Should handle case sensitivity in name search")
        void shouldHandleCaseSensitivityInNameSearch() {
            Optional<Tag> foundTag = tagRepository.findByName("important");
            
            // Assuming case-sensitive search
            assertThat(foundTag).isEmpty();
        }

        @Test
        @DisplayName("Should find tags by name containing pattern case insensitive")
        void shouldFindTagsByNameContainingPatternCaseInsensitive() {
            List<Tag> tagsWithWork = tagRepository.findByNameContainingIgnoreCase("work");
            
            assertThat(tagsWithWork).hasSize(1);
            assertThat(tagsWithWork.get(0).getName()).isEqualTo("Work");
        }

        @Test
        @DisplayName("Should find tags by partial name case insensitive")
        void shouldFindTagsByPartialNameCaseInsensitive() {
            List<Tag> tagsWithPer = tagRepository.findByNameContainingIgnoreCase("PER");
            
            assertThat(tagsWithPer).hasSize(1);
            assertThat(tagsWithPer.get(0).getName()).isEqualTo("Personal");
        }

        @Test
        @DisplayName("Should find multiple tags by common pattern")
        void shouldFindMultipleTagsByCommonPattern() {
            // Create tags with common pattern
            Tag projectTag = new Tag("Project Alpha", "cyan");
            Tag projectBetaTag = new Tag("Project Beta", "magenta");
            
            entityManager.persist(projectTag);
            entityManager.persist(projectBetaTag);
            entityManager.flush();

            List<Tag> projectTags = tagRepository.findByNameContainingIgnoreCase("project");
            
            assertThat(projectTags).hasSize(2);
            assertThat(projectTags).extracting(Tag::getName)
                .containsExactlyInAnyOrder("Project Alpha", "Project Beta");
        }

        @Test
        @DisplayName("Should return empty list for non-matching pattern")
        void shouldReturnEmptyListForNonMatchingPattern() {
            List<Tag> tags = tagRepository.findByNameContainingIgnoreCase("xyz123");
            
            assertThat(tags).isEmpty();
        }
    }

    @Nested
    @DisplayName("Note Association Queries")
    class NoteAssociationQueries {

        @Test
        @DisplayName("Should find tags by note ID")
        void shouldFindTagsByNoteId() {
            List<Tag> note1Tags = tagRepository.findByNoteId(note1.getId());
            
            assertThat(note1Tags).hasSize(1);
            assertThat(note1Tags.get(0).getName()).isEqualTo("Work");
        }

        @Test
        @DisplayName("Should find multiple tags for note with multiple associations")
        void shouldFindMultipleTagsForNoteWithMultipleAssociations() {
            List<Tag> note3Tags = tagRepository.findByNoteId(note3.getId());
            
            assertThat(note3Tags).hasSize(2);
            assertThat(note3Tags).extracting(Tag::getName)
                .containsExactlyInAnyOrder("Important", "Work");
        }

        @Test
        @DisplayName("Should return empty list for note with no tags")
        void shouldReturnEmptyListForNoteWithNoTags() {
            Note noteWithoutTags = new Note();
            noteWithoutTags.setTitle("Untagged Note");
            noteWithoutTags.setContent("This note has no tags");
            noteWithoutTags.setUserId(3L);
            noteWithoutTags.setCreatedAt(LocalDateTime.now());
            noteWithoutTags.setUpdatedAt(LocalDateTime.now());
            
            entityManager.persist(noteWithoutTags);
            entityManager.flush();

            List<Tag> tags = tagRepository.findByNoteId(noteWithoutTags.getId());
            
            assertThat(tags).isEmpty();
        }

        @Test
        @DisplayName("Should return empty list for non-existent note ID")
        void shouldReturnEmptyListForNonExistentNoteId() {
            List<Tag> tags = tagRepository.findByNoteId(999L);
            
            assertThat(tags).isEmpty();
        }

        @Test
        @DisplayName("Should count notes by tag ID")
        void shouldCountNotesByTagId() {
            Long workTagNoteCount = tagRepository.countNotesByTagId(tag2.getId());
            Long personalTagNoteCount = tagRepository.countNotesByTagId(tag3.getId());
            Long importantTagNoteCount = tagRepository.countNotesByTagId(tag1.getId());
            
            assertThat(workTagNoteCount).isEqualTo(2L); // note1 and note3
            assertThat(personalTagNoteCount).isEqualTo(1L); // note2
            assertThat(importantTagNoteCount).isEqualTo(1L); // note3
        }

        @Test
        @DisplayName("Should return 0 for tag with no associated notes")
        void shouldReturnZeroForTagWithNoAssociatedNotes() {
            Tag unassociatedTag = new Tag("Unused", "gray");
            entityManager.persist(unassociatedTag);
            entityManager.flush();

            Long noteCount = tagRepository.countNotesByTagId(unassociatedTag.getId());
            
            assertThat(noteCount).isEqualTo(0L);
        }

        @Test
        @DisplayName("Should return 0 for non-existent tag ID")
        void shouldReturnZeroForNonExistentTagId() {
            Long noteCount = tagRepository.countNotesByTagId(UUID.randomUUID());
            
            assertThat(noteCount).isEqualTo(0L);
        }
    }

    @Nested
    @DisplayName("Data Integrity and Constraints")
    class DataIntegrityAndConstraints {

        @Test
        @DisplayName("Should enforce unique tag name constraint")
        void shouldEnforceUniqueTagNameConstraint() {
            Tag duplicateNameTag = new Tag("Important", "yellow"); // Same name as existing tag

            assertThatThrownBy(() -> {
                tagRepository.save(duplicateNameTag);
                entityManager.flush();
            }).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Should handle null color value")
        void shouldHandleNullColorValue() {
            Tag tagWithNullColor = new Tag("NoColor", null);

            Tag savedTag = tagRepository.save(tagWithNullColor);
            
            assertThat(savedTag.getId()).isNotNull();
            assertThat(savedTag.getName()).isEqualTo("NoColor");
            assertThat(savedTag.getColor()).isNull();
        }

        @Test
        @DisplayName("Should handle empty string values")
        void shouldHandleEmptyStringValues() {
            Tag tagWithEmptyColor = new Tag("EmptyColor", "");

            Tag savedTag = tagRepository.save(tagWithEmptyColor);
            
            assertThat(savedTag.getId()).isNotNull();
            assertThat(savedTag.getName()).isEqualTo("EmptyColor");
            assertThat(savedTag.getColor()).isEqualTo("");
        }

        @Test
        @DisplayName("Should handle very long tag names")
        void shouldHandleVeryLongTagNames() {
            String longName = "a".repeat(255); // Assuming max length limit
            Tag longNameTag = new Tag(longName, "blue");

            Tag savedTag = tagRepository.save(longNameTag);
            
            assertThat(savedTag.getId()).isNotNull();
            assertThat(savedTag.getName()).hasSize(255);
        }

        @Test
        @DisplayName("Should handle special characters in tag name")
        void shouldHandleSpecialCharactersInTagName() {
            Tag specialCharTag = new Tag("测试 Tag! @#$%^&*()", "purple");

            Tag savedTag = tagRepository.save(specialCharTag);
            
            assertThat(savedTag.getId()).isNotNull();
            assertThat(savedTag.getName()).isEqualTo("测试 Tag! @#$%^&*()");
        }

        @Test
        @DisplayName("Should handle unicode characters in color")
        void shouldHandleUnicodeCharactersInColor() {
            Tag unicodeColorTag = new Tag("UnicodeColor", "🔴红色");

            Tag savedTag = tagRepository.save(unicodeColorTag);
            
            assertThat(savedTag.getId()).isNotNull();
            assertThat(savedTag.getColor()).isEqualTo("🔴红色");
        }
    }

    @Nested
    @DisplayName("Performance and Edge Cases")
    class PerformanceAndEdgeCases {

        @Test
        @DisplayName("Should handle large number of tags")
        void shouldHandleLargeNumberOfTags() {
            // Create many tags for performance testing
            for (int i = 0; i < 100; i++) {
                Tag tag = new Tag("PerfTag" + i, "color" + i);
                entityManager.persist(tag);
            }
            entityManager.flush();

            List<Tag> allTags = tagRepository.findAll();
            
            assertThat(allTags).hasSizeGreaterThanOrEqualTo(100);
        }

        @Test
        @DisplayName("Should handle empty database scenario")
        void shouldHandleEmptyDatabaseScenario() {
            // Clear all data
            tagRepository.deleteAll();
            entityManager.flush();

            assertThat(tagRepository.findAll()).isEmpty();
            assertThat(tagRepository.findByName("anything")).isEmpty();
            assertThat(tagRepository.findByNameContainingIgnoreCase("anything")).isEmpty();
        }

        @Test
        @DisplayName("Should handle complex tag-note relationships")
        void shouldHandleComplexTagNoteRelationships() {
            // Create multiple notes with overlapping tag associations
            Note multiTagNote1 = new Note();
            multiTagNote1.setTitle("Multi Tag Note 1");
            multiTagNote1.setContent("Content 1");
            multiTagNote1.setUserId(4L);
            multiTagNote1.setCreatedAt(LocalDateTime.now());
            multiTagNote1.setUpdatedAt(LocalDateTime.now());

            Note multiTagNote2 = new Note();
            multiTagNote2.setTitle("Multi Tag Note 2");
            multiTagNote2.setContent("Content 2");
            multiTagNote2.setUserId(5L);
            multiTagNote2.setCreatedAt(LocalDateTime.now());
            multiTagNote2.setUpdatedAt(LocalDateTime.now());

            entityManager.persist(multiTagNote1);
            entityManager.persist(multiTagNote2);

            // Associate multiple tags with multiple notes
            multiTagNote1.getTags().add(tag1);
            multiTagNote1.getTags().add(tag2);
            multiTagNote1.getTags().add(tag3);

            multiTagNote2.getTags().add(tag1);
            multiTagNote2.getTags().add(tag3);

            entityManager.flush();

            // Test various queries
            assertThat(tagRepository.countNotesByTagId(tag1.getId())).isEqualTo(3L); // note3, multiTagNote1, multiTagNote2
            assertThat(tagRepository.countNotesByTagId(tag2.getId())).isEqualTo(3L); // note1, note3, multiTagNote1
            assertThat(tagRepository.countNotesByTagId(tag3.getId())).isEqualTo(3L); // note2, multiTagNote1, multiTagNote2

            List<Tag> note1AllTags = tagRepository.findByNoteId(multiTagNote1.getId());
            assertThat(note1AllTags).hasSize(3);
        }

        @Test
        @DisplayName("Should handle tag deletion with associated notes")
        void shouldHandleTagDeletionWithAssociatedNotes() {
            UUID tagIdToDelete = tag2.getId();
            Long initialNoteCount = tagRepository.countNotesByTagId(tagIdToDelete);
            
            assertThat(initialNoteCount).isGreaterThan(0L);

            // Delete the tag
            tagRepository.delete(tag2);
            entityManager.flush();

            // Tag should be deleted
            assertThat(tagRepository.findById(tagIdToDelete)).isEmpty();

            // Notes should still exist (assuming no cascade delete)
            assertThat(noteRepository.findById(note1.getId())).isPresent();
            assertThat(noteRepository.findById(note3.getId())).isPresent();
        }

        @Test
        @DisplayName("Should handle concurrent tag operations")
        void shouldHandleConcurrentTagOperations() {
            // Simulate concurrent access to the same tag
            Optional<Tag> tag1Instance1 = tagRepository.findById(tag1.getId());
            Optional<Tag> tag1Instance2 = tagRepository.findById(tag1.getId());

            assertThat(tag1Instance1).isPresent();
            assertThat(tag1Instance2).isPresent();

            // Update both instances
            tag1Instance1.get().setColor("newcolor1");
            tag1Instance2.get().setColor("newcolor2");

            tagRepository.save(tag1Instance1.get());
            tagRepository.save(tag1Instance2.get());
            entityManager.flush();

            // The last update should win
            Optional<Tag> finalTag = tagRepository.findById(tag1.getId());
            assertThat(finalTag).isPresent();
            assertThat(finalTag.get().getColor()).isEqualTo("newcolor2");
        }
    }

    @Nested
    @DisplayName("Complex Search Scenarios")
    class ComplexSearchScenarios {

        @Test
        @DisplayName("Should handle mixed case search patterns")
        void shouldHandleMixedCaseSearchPatterns() {
            List<Tag> foundTags = tagRepository.findByNameContainingIgnoreCase("IMP");
            
            assertThat(foundTags).hasSize(1);
            assertThat(foundTags.get(0).getName()).isEqualTo("Important");
        }

        @Test
        @DisplayName("Should find tags with partial matches in the middle")
        void shouldFindTagsWithPartialMatchesInTheMidddle() {
            Tag compoundTag = new Tag("SuperImportant", "crimson");
            entityManager.persist(compoundTag);
            entityManager.flush();

            List<Tag> foundTags = tagRepository.findByNameContainingIgnoreCase("import");
            
            assertThat(foundTags).hasSize(2);
            assertThat(foundTags).extracting(Tag::getName)
                .containsExactlyInAnyOrder("Important", "SuperImportant");
        }

        @Test
        @DisplayName("Should handle searching with special characters")
        void shouldHandleSearchingWithSpecialCharacters() {
            Tag specialTag = new Tag("C++ Programming", "navy");
            entityManager.persist(specialTag);
            entityManager.flush();

            List<Tag> foundTags = tagRepository.findByNameContainingIgnoreCase("++");
            
            assertThat(foundTags).hasSize(1);
            assertThat(foundTags.get(0).getName()).isEqualTo("C++ Programming");
        }

        @Test
        @DisplayName("Should handle empty search patterns")
        void shouldHandleEmptySearchPatterns() {
            List<Tag> foundTags = tagRepository.findByNameContainingIgnoreCase("");
            
            // Empty pattern should match all tags
            assertThat(foundTags).hasSize(3);
        }

        @Test
        @DisplayName("Should handle whitespace in search patterns")
        void shouldHandleWhitespaceInSearchPatterns() {
            Tag spacedTag = new Tag("Project Management", "teal");
            entityManager.persist(spacedTag);
            entityManager.flush();

            List<Tag> foundTags = tagRepository.findByNameContainingIgnoreCase("project management");
            
            assertThat(foundTags).hasSize(1);
            assertThat(foundTags.get(0).getName()).isEqualTo("Project Management");
        }
    }

    @Nested
    @DisplayName("Relationship Integrity Tests")
    class RelationshipIntegrityTests {

        @Test
        @DisplayName("Should maintain referential integrity when note is deleted")
        void shouldMaintainReferentialIntegrityWhenNoteIsDeleted() {
            Long noteId = note1.getId();
            UUID tagId = tag2.getId();
            
            // Verify initial association
            assertThat(tagRepository.countNotesByTagId(tagId)).isGreaterThan(0L);

            // Delete the note
            noteRepository.delete(note1);
            entityManager.flush();

            // Tag should still exist
            assertThat(tagRepository.findById(tagId)).isPresent();

            // Note count should be updated
            Long remainingCount = tagRepository.countNotesByTagId(tagId);
            assertThat(remainingCount).isEqualTo(1L); // Only note3 should remain
        }

        @Test
        @DisplayName("Should handle adding new note-tag associations")
        void shouldHandleAddingNewNoteTagAssociations() {
            Note newNote = new Note();
            newNote.setTitle("New Associated Note");
            newNote.setContent("This note will be associated with existing tags");
            newNote.setUserId(6L);
            newNote.setCreatedAt(LocalDateTime.now());
            newNote.setUpdatedAt(LocalDateTime.now());

            entityManager.persist(newNote);

            // Associate with existing tags
            newNote.getTags().add(tag1);
            newNote.getTags().add(tag3);

            entityManager.flush();

            // Verify associations
            List<Tag> noteTags = tagRepository.findByNoteId(newNote.getId());
            assertThat(noteTags).hasSize(2);
            assertThat(noteTags).extracting(Tag::getName)
                .containsExactlyInAnyOrder("Important", "Personal");

            assertThat(tagRepository.countNotesByTagId(tag1.getId())).isEqualTo(2L);
            assertThat(tagRepository.countNotesByTagId(tag3.getId())).isEqualTo(2L);
        }

        @Test
        @DisplayName("Should handle removing note-tag associations")
        void shouldHandleRemovingNoteTagAssociations() {
            UUID tag2Id = tag2.getId();
            Long initialCount = tagRepository.countNotesByTagId(tag2Id);

            // Remove tag association from note3
            note3.getTags().remove(tag2);
            entityManager.flush();

            // Verify the association is removed
            List<Tag> note3Tags = tagRepository.findByNoteId(note3.getId());
            assertThat(note3Tags).hasSize(1);
            assertThat(note3Tags.get(0).getName()).isEqualTo("Important");

            // Verify count is updated
            Long newCount = tagRepository.countNotesByTagId(tag2Id);
            assertThat(newCount).isEqualTo(initialCount - 1);
        }
    }
}

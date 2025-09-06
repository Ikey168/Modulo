package com.modulo.service;

import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import com.modulo.plugin.event.NoteEvent;
import com.modulo.plugin.event.PluginEventBus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.Authentication;

import javax.persistence.EntityManager;
import javax.persistence.Query;
import javax.persistence.TypedQuery;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Note Service Tests")
class NoteServiceTest {

    @Mock
    private EntityManager entityManager;

    @Mock
    private PluginEventBus eventBus;

    @Mock
    private AttachmentService attachmentService;

    @Mock
    private Query query;

    @Mock
    private TypedQuery<Note> typedQuery;

    @Mock
    private SecurityContext securityContext;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private NoteService noteService;

    @Captor
    private ArgumentCaptor<NoteEvent> eventCaptor;

    private Note testNote;
    private Tag testTag;

    @BeforeEach
    void setUp() {
        testNote = new Note();
        testNote.setId(1L);
        testNote.setTitle("Test Note");
        testNote.setContent("Test content");
        testNote.setUserId(100L);
        testNote.setCreatedAt(LocalDateTime.now().minusDays(1));
        testNote.setUpdatedAt(LocalDateTime.now());

        testTag = new Tag();
        testTag.setId(1L);
        testTag.setName("test");

        // Mock Security Context
        SecurityContextHolder.setContext(securityContext);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getName()).thenReturn("testuser");
    }

    @Nested
    @DisplayName("Find Operations")
    class FindOperations {

        @Test
        @DisplayName("Should find note by ID successfully")
        void shouldFindNoteByIdSuccessfully() {
            // Arrange
            when(entityManager.find(Note.class, 1L)).thenReturn(testNote);

            // Act
            Optional<Note> result = noteService.findById(1L);

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get()).isEqualTo(testNote);
            verify(entityManager).find(Note.class, 1L);
        }

        @Test
        @DisplayName("Should return empty when note not found")
        void shouldReturnEmptyWhenNoteNotFound() {
            // Arrange
            when(entityManager.find(Note.class, 999L)).thenReturn(null);

            // Act
            Optional<Note> result = noteService.findById(999L);

            // Assert
            assertThat(result).isEmpty();
            verify(entityManager).find(Note.class, 999L);
        }

        @Test
        @DisplayName("Should handle exception when finding note by ID")
        void shouldHandleExceptionWhenFindingNoteById() {
            // Arrange
            when(entityManager.find(Note.class, 1L)).thenThrow(new RuntimeException("Database error"));

            // Act
            Optional<Note> result = noteService.findById(1L);

            // Assert
            assertThat(result).isEmpty();
            verify(entityManager).find(Note.class, 1L);
        }

        @Test
        @DisplayName("Should find notes by user ID")
        void shouldFindNotesByUserId() {
            // Arrange
            List<Note> expectedNotes = Arrays.asList(testNote);
            when(entityManager.createQuery("SELECT n FROM Note n WHERE n.userId = :userId ORDER BY n.updatedAt DESC"))
                    .thenReturn(query);
            when(query.setParameter("userId", 100L)).thenReturn(query);
            when(query.getResultList()).thenReturn(expectedNotes);

            // Act
            List<Note> result = noteService.findByUserId(100L);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0)).isEqualTo(testNote);
            verify(entityManager).createQuery("SELECT n FROM Note n WHERE n.userId = :userId ORDER BY n.updatedAt DESC");
            verify(query).setParameter("userId", 100L);
        }
    }

    @Nested
    @DisplayName("Save Operations")
    class SaveOperations {

        @Test
        @DisplayName("Should create new note successfully")
        void shouldCreateNewNoteSuccessfully() {
            // Arrange
            Note newNote = new Note();
            newNote.setTitle("New Note");
            newNote.setContent("New content");
            newNote.setUserId(100L);

            Note savedNote = new Note();
            savedNote.setId(2L);
            savedNote.setTitle("New Note");
            savedNote.setContent("New content");
            savedNote.setUserId(100L);
            savedNote.setCreatedAt(LocalDateTime.now());
            savedNote.setUpdatedAt(LocalDateTime.now());

            when(entityManager.merge(any(Note.class))).thenReturn(savedNote);

            // Act
            Note result = noteService.save(newNote);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.getId()).isEqualTo(2L);
            assertThat(result.getTitle()).isEqualTo("New Note");
            assertThat(result.getCreatedAt()).isNotNull();
            assertThat(result.getUpdatedAt()).isNotNull();

            verify(entityManager).merge(any(Note.class));
            verify(entityManager).flush();
            verify(eventBus).publishAsync(any(NoteEvent.NoteCreated.class));
        }

        @Test
        @DisplayName("Should update existing note successfully")
        void shouldUpdateExistingNoteSuccessfully() {
            // Arrange
            Note existingNote = new Note();
            existingNote.setId(1L);
            existingNote.setTitle("Original Title");
            existingNote.setContent("Original content");
            existingNote.setUserId(100L);
            existingNote.setCreatedAt(LocalDateTime.now().minusDays(1));

            Note updatedNote = new Note();
            updatedNote.setId(1L);
            updatedNote.setTitle("Updated Title");
            updatedNote.setContent("Updated content");
            updatedNote.setUserId(100L);
            updatedNote.setCreatedAt(existingNote.getCreatedAt());

            when(entityManager.find(Note.class, 1L)).thenReturn(existingNote);
            when(entityManager.merge(any(Note.class))).thenReturn(updatedNote);

            // Act
            Note result = noteService.save(updatedNote);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.getTitle()).isEqualTo("Updated Title");
            assertThat(result.getUpdatedAt()).isNotNull();

            verify(entityManager).find(Note.class, 1L);
            verify(entityManager).merge(any(Note.class));
            verify(entityManager).flush();
            verify(eventBus).publishAsync(any(NoteEvent.NoteUpdated.class));
        }

        @Test
        @DisplayName("Should set timestamps correctly on save")
        void shouldSetTimestampsCorrectlyOnSave() {
            // Arrange
            Note newNote = new Note();
            newNote.setTitle("Time Test Note");
            newNote.setContent("Test content");
            newNote.setUserId(100L);

            when(entityManager.merge(any(Note.class))).thenAnswer(invocation -> {
                Note note = invocation.getArgument(0);
                note.setId(1L);
                return note;
            });

            // Act
            Note result = noteService.save(newNote);

            // Assert
            assertThat(result.getCreatedAt()).isNotNull();
            assertThat(result.getUpdatedAt()).isNotNull();
            assertThat(result.getCreatedAt()).isEqualTo(result.getUpdatedAt());
        }
    }

    @Nested
    @DisplayName("Delete Operations")
    class DeleteOperations {

        @Test
        @DisplayName("Should delete note successfully")
        void shouldDeleteNoteSuccessfully() {
            // Arrange
            when(entityManager.find(Note.class, 1L)).thenReturn(testNote);

            // Act
            noteService.deleteById(1L);

            // Assert
            verify(entityManager).find(Note.class, 1L);
            verify(entityManager).remove(testNote);
            verify(entityManager).flush();
            verify(eventBus).publishAsync(any(NoteEvent.NoteDeleted.class));
        }

        @Test
        @DisplayName("Should handle delete of non-existent note gracefully")
        void shouldHandleDeleteOfNonExistentNoteGracefully() {
            // Arrange
            when(entityManager.find(Note.class, 999L)).thenReturn(null);

            // Act
            noteService.deleteById(999L);

            // Assert
            verify(entityManager).find(Note.class, 999L);
            verify(entityManager, never()).remove(any());
            verify(eventBus, never()).publishAsync(any());
        }
    }

    @Nested
    @DisplayName("Search Operations")
    class SearchOperations {

        @Test
        @DisplayName("Should search notes with query parameter")
        void shouldSearchNotesWithQueryParameter() {
            // Arrange
            List<Note> expectedNotes = Arrays.asList(testNote);
            when(entityManager.createQuery(anyString())).thenReturn(query);
            when(query.setParameter(anyString(), any())).thenReturn(query);
            when(query.setFirstResult(anyInt())).thenReturn(query);
            when(query.setMaxResults(anyInt())).thenReturn(query);
            when(query.getResultList()).thenReturn(expectedNotes);

            // Act
            List<Note> result = noteService.searchNotes("test", null, 100L, 10, 0);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0)).isEqualTo(testNote);
            verify(query).setParameter("query", "%test%");
            verify(query).setParameter("userId", 100L);
            verify(query).setFirstResult(0);
            verify(query).setMaxResults(10);
        }

        @Test
        @DisplayName("Should search notes with tags filter")
        void shouldSearchNotesWithTagsFilter() {
            // Arrange
            List<String> tags = Arrays.asList("test", "important");
            List<Note> expectedNotes = Arrays.asList(testNote);
            when(entityManager.createQuery(anyString())).thenReturn(query);
            when(query.setParameter(anyString(), any())).thenReturn(query);
            when(query.setFirstResult(anyInt())).thenReturn(query);
            when(query.setMaxResults(anyInt())).thenReturn(query);
            when(query.getResultList()).thenReturn(expectedNotes);

            // Act
            List<Note> result = noteService.searchNotes(null, tags, 100L, 10, 0);

            // Assert
            assertThat(result).hasSize(1);
            verify(query).setParameter("tags", tags);
            verify(query).setParameter("userId", 100L);
        }

        @Test
        @DisplayName("Should search notes with all filters")
        void shouldSearchNotesWithAllFilters() {
            // Arrange
            List<String> tags = Arrays.asList("test");
            List<Note> expectedNotes = Arrays.asList(testNote);
            when(entityManager.createQuery(anyString())).thenReturn(query);
            when(query.setParameter(anyString(), any())).thenReturn(query);
            when(query.setFirstResult(anyInt())).thenReturn(query);
            when(query.setMaxResults(anyInt())).thenReturn(query);
            when(query.getResultList()).thenReturn(expectedNotes);

            // Act
            List<Note> result = noteService.searchNotes("content", tags, 100L, 5, 10);

            // Assert
            assertThat(result).hasSize(1);
            verify(query).setParameter("query", "%content%");
            verify(query).setParameter("tags", tags);
            verify(query).setParameter("userId", 100L);
            verify(query).setFirstResult(10);
            verify(query).setMaxResults(5);
        }

        @Test
        @DisplayName("Should search notes without filters")
        void shouldSearchNotesWithoutFilters() {
            // Arrange
            List<Note> expectedNotes = Arrays.asList(testNote);
            when(entityManager.createQuery(anyString())).thenReturn(query);
            when(query.setFirstResult(anyInt())).thenReturn(query);
            when(query.setMaxResults(anyInt())).thenReturn(query);
            when(query.getResultList()).thenReturn(expectedNotes);

            // Act
            List<Note> result = noteService.searchNotes(null, null, null, 10, 0);

            // Assert
            assertThat(result).hasSize(1);
            verify(query, never()).setParameter(eq("query"), any());
            verify(query, never()).setParameter(eq("tags"), any());
            verify(query, never()).setParameter(eq("userId"), any());
        }
    }

    @Nested
    @DisplayName("Error Handling")
    class ErrorHandling {

        @Test
        @DisplayName("Should handle null inputs gracefully")
        void shouldHandleNullInputsGracefully() {
            // Test null note save
            assertThatThrownBy(() -> noteService.save(null))
                    .isInstanceOf(Exception.class);

            // Test null ID find
            Optional<Note> result = noteService.findById(null);
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Should handle database exceptions during save")
        void shouldHandleDatabaseExceptionsDuringSave() {
            // Arrange
            Note newNote = new Note();
            newNote.setTitle("Test");
            when(entityManager.merge(any(Note.class))).thenThrow(new RuntimeException("DB Error"));

            // Act & Assert
            assertThatThrownBy(() -> noteService.save(newNote))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("DB Error");
        }

        @Test
        @DisplayName("Should handle empty search results")
        void shouldHandleEmptySearchResults() {
            // Arrange
            when(entityManager.createQuery(anyString())).thenReturn(query);
            when(query.setParameter(anyString(), any())).thenReturn(query);
            when(query.setFirstResult(anyInt())).thenReturn(query);
            when(query.setMaxResults(anyInt())).thenReturn(query);
            when(query.getResultList()).thenReturn(Collections.emptyList());

            // Act
            List<Note> result = noteService.searchNotes("nonexistent", null, 100L, 10, 0);

            // Assert
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("Event Publishing")
    class EventPublishing {

        @Test
        @DisplayName("Should publish NoteCreated event on new note")
        void shouldPublishNoteCreatedEventOnNewNote() {
            // Arrange
            Note newNote = new Note();
            newNote.setTitle("Event Test Note");
            when(entityManager.merge(any(Note.class))).thenReturn(testNote);

            // Act
            noteService.save(newNote);

            // Assert
            verify(eventBus).publishAsync(eventCaptor.capture());
            NoteEvent capturedEvent = eventCaptor.getValue();
            assertThat(capturedEvent).isInstanceOf(NoteEvent.NoteCreated.class);
        }

        @Test
        @DisplayName("Should publish NoteUpdated event on existing note")
        void shouldPublishNoteUpdatedEventOnExistingNote() {
            // Arrange
            testNote.setTitle("Updated Title");
            when(entityManager.find(Note.class, 1L)).thenReturn(testNote);
            when(entityManager.merge(any(Note.class))).thenReturn(testNote);

            // Act
            noteService.save(testNote);

            // Assert
            verify(eventBus).publishAsync(eventCaptor.capture());
            NoteEvent capturedEvent = eventCaptor.getValue();
            assertThat(capturedEvent).isInstanceOf(NoteEvent.NoteUpdated.class);
        }

        @Test
        @DisplayName("Should publish NoteDeleted event on deletion")
        void shouldPublishNoteDeletedEventOnDeletion() {
            // Arrange
            when(entityManager.find(Note.class, 1L)).thenReturn(testNote);

            // Act
            noteService.deleteById(1L);

            // Assert
            verify(eventBus).publishAsync(eventCaptor.capture());
            NoteEvent capturedEvent = eventCaptor.getValue();
            assertThat(capturedEvent).isInstanceOf(NoteEvent.NoteDeleted.class);
        }
    }
}

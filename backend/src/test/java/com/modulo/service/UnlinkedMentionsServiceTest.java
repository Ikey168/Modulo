package com.modulo.service;

import com.modulo.entity.Note;
import com.modulo.entity.NoteLink;
import com.modulo.graph.dto.UnlinkedMentionDto;
import com.modulo.repository.NoteLinkRepository;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("UnlinkedMentionsService Tests (#252)")
class UnlinkedMentionsServiceTest {

    @Mock
    private NoteRepository noteRepository;

    @Mock
    private NoteLinkRepository noteLinkRepository;

    @InjectMocks
    private UnlinkedMentionsService service;

    private Note target;

    private static Note note(Long id, String title, String content) {
        Note n = new Note(title, content);
        n.setId(id);
        return n;
    }

    @BeforeEach
    void setUp() {
        target = note(1L, "Graph Theory", "The study of graphs.");
    }

    @Test
    @DisplayName("throws when the note does not exist")
    void throwsWhenNoteMissing() {
        when(noteRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.findUnlinkedMentions(99L))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("matches title with word boundaries and builds a snippet")
    void matchesTitleMention() {
        Note mentions = note(2L, "Algorithms", "I love Graph Theory in computer science.");
        when(noteRepository.findById(1L)).thenReturn(Optional.of(target));
        when(noteLinkRepository.findByTargetNoteId(1L)).thenReturn(Collections.emptyList());
        when(noteRepository.findByTitleOrContentContainingIgnoreCase(eq("Graph Theory")))
            .thenReturn(Collections.singletonList(mentions));

        List<UnlinkedMentionDto> result = service.findUnlinkedMentions(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(2L);
        assertThat(result.get(0).getMatchedText()).isEqualTo("Graph Theory");
        assertThat(result.get(0).getSnippet()).contains("Graph Theory");
    }

    @Test
    @DisplayName("excludes the note itself and notes that already link to it")
    void excludesSelfAndAlreadyLinked() {
        Note alreadyLinking = note(2L, "Linked", "References Graph Theory already.");
        Note selfMatch = note(1L, "Graph Theory", "Graph Theory mentions itself.");

        NoteLink existing = new NoteLink(alreadyLinking, target, "REFERENCE");
        when(noteRepository.findById(1L)).thenReturn(Optional.of(target));
        when(noteLinkRepository.findByTargetNoteId(1L)).thenReturn(Collections.singletonList(existing));
        when(noteRepository.findByTitleOrContentContainingIgnoreCase(anyString()))
            .thenReturn(Arrays.asList(alreadyLinking, selfMatch));

        List<UnlinkedMentionDto> result = service.findUnlinkedMentions(1L);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("does not match when the term only appears as a substring of another word")
    void wordBoundaryPreventsSubstringMatch() {
        target = note(1L, "Art", "About art.");
        Note candidate = note(2L, "Cart", "This is about carts and parts, not the topic.");
        when(noteRepository.findById(1L)).thenReturn(Optional.of(target));
        when(noteLinkRepository.findByTargetNoteId(1L)).thenReturn(Collections.emptyList());
        when(noteRepository.findByTitleOrContentContainingIgnoreCase(eq("Art")))
            .thenReturn(Collections.singletonList(candidate));

        List<UnlinkedMentionDto> result = service.findUnlinkedMentions(1L);

        // "Art" appears only inside "carts"/"parts" → no word-boundary match.
        assertThat(result).isEmpty();
    }
}

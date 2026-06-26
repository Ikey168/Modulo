package com.modulo.editor;

import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("NoteExportController Tests (#269)")
class NoteExportControllerTest {

    @Mock
    private NoteRepository noteRepository;

    @InjectMocks
    private NoteExportController controller;

    private Note note;

    @BeforeEach
    void setUp() {
        note = new Note("Graph Theory", "Graphs are useful. See [[Algorithms]].");
        note.setId(1L);
    }

    @Test
    @DisplayName("markdown export returns 404 for unknown note")
    void markdownExportNotFound() {
        when(noteRepository.findById(99L)).thenReturn(Optional.empty());
        assertThat(controller.exportMarkdown(99L, false).getStatusCode())
            .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("markdown export returns content with title header")
    void markdownExportContainsTitleHeader() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));

        ResponseEntity<byte[]> resp = controller.exportMarkdown(1L, false);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        String content = new String(resp.getBody());
        assertThat(content).startsWith("# Graph Theory");
        assertThat(content).contains("Graphs are useful");
    }

    @Test
    @DisplayName("markdown export with resolveLinks keeps wiki-link text when no matching note")
    void markdownExportResolvesLinksGracefully() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));
        when(noteRepository.findByTitleOrContentContainingIgnoreCase("Algorithms"))
            .thenReturn(List.of());

        ResponseEntity<byte[]> resp = controller.exportMarkdown(1L, true);

        String content = new String(resp.getBody());
        // Unresolvable [[Algorithms]] becomes plain "Algorithms"
        assertThat(content).contains("Algorithms");
        assertThat(content).doesNotContain("[[Algorithms]]");
    }

    @Test
    @DisplayName("HTML export wraps content in print-ready page")
    void htmlExportWrapsPage() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));

        ResponseEntity<String> resp = controller.exportHtml(1L, false);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("<!DOCTYPE html>");
        assertThat(resp.getBody()).contains("<title>Graph Theory</title>");
        assertThat(resp.getBody()).contains("@media print");
    }

    @Test
    @DisplayName("ZIP export returns non-empty bytes for existing notes")
    void zipExportNonEmpty() {
        when(noteRepository.findAll()).thenReturn(List.of(note));

        ResponseEntity<byte[]> resp = controller.exportZip(null, false);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotEmpty();
    }

    @Test
    @DisplayName("ZIP export returns 204 when no notes exist")
    void zipExportEmptyWhenNoNotes() {
        when(noteRepository.findAll()).thenReturn(List.of());
        assertThat(controller.exportZip(null, false).getStatusCode())
            .isEqualTo(HttpStatus.NO_CONTENT);
    }
}

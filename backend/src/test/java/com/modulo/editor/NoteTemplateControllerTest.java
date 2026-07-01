package com.modulo.editor;

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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("NoteTemplateController Tests (#268)")
class NoteTemplateControllerTest {

    @Mock
    private NoteTemplateRepository repository;

    @InjectMocks
    private NoteTemplateController controller;

    private NoteTemplate template;

    @BeforeEach
    void setUp() {
        template = new NoteTemplate();
        template.setId(1L);
        template.setName("Meeting Notes");
        template.setContent("# {{title}}\n\nDate: {{date}}\n\n## Agenda\n\n## Action Items");
        template.setVariables("title");
        template.setOwnerId("alice");
    }

    @Test
    @DisplayName("list returns templates visible to the user")
    void listReturnsTemplates() {
        when(repository.findByOwnerIdIsNullOrOwnerIdOrderByNameAsc("alice"))
            .thenReturn(List.of(template));

        List<NoteTemplateDto> result = controller.list("alice");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("Meeting Notes");
    }

    @Test
    @DisplayName("get returns 404 for unknown id")
    void getNotFound() {
        when(repository.findById(99L)).thenReturn(Optional.empty());
        ResponseEntity<NoteTemplateDto> resp = controller.get(99L);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("create returns 400 when name is blank")
    void createRejectsBlankName() {
        var req = new NoteTemplateController.CreateTemplateRequest();
        req.setName("  ");
        ResponseEntity<NoteTemplateDto> resp = controller.create(req, "alice");
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("create saves template with owner id")
    void createSavesWithOwnerId() {
        when(repository.save(any())).thenReturn(template);
        var req = new NoteTemplateController.CreateTemplateRequest();
        req.setName("Meeting Notes");
        req.setContent("# {{title}}");
        req.setVariables(List.of("title"));

        ResponseEntity<NoteTemplateDto> resp = controller.create(req, "alice");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(repository).save(any(NoteTemplate.class));
    }

    @Test
    @DisplayName("apply substitutes built-in and custom variables")
    void applySubstitutesVariables() {
        when(repository.findById(1L)).thenReturn(Optional.of(template));

        ResponseEntity<java.util.Map<String, String>> resp =
            controller.apply(1L, java.util.Map.of("title", "Q2 Sync"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().get("content")).contains("# Q2 Sync");
        // {{date}} is substituted with today's date
        assertThat(resp.getBody().get("content")).contains(java.time.LocalDate.now().toString());
    }

    @Test
    @DisplayName("delete returns 404 when template belongs to another user")
    void deleteBlockedForOtherUser() {
        when(repository.findById(1L)).thenReturn(Optional.of(template));
        ResponseEntity<Void> resp = controller.delete(1L, "bob");
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        verify(repository, never()).delete(any());
    }
}

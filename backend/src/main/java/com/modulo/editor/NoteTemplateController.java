package com.modulo.editor;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/templates")
@CrossOrigin(originPatterns = "*")
@RequiredArgsConstructor
public class NoteTemplateController {

    private final NoteTemplateRepository repository;

    @GetMapping
    public List<NoteTemplateDto> list(
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        return repository.findByOwnerIdIsNullOrOwnerIdOrderByNameAsc(userId)
                         .stream()
                         .map(NoteTemplateDto::from)
                         .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<NoteTemplateDto> get(@PathVariable Long id) {
        return repository.findById(id)
            .map(t -> ResponseEntity.ok(NoteTemplateDto.from(t)))
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<NoteTemplateDto> create(
            @RequestBody CreateTemplateRequest req,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        if (req.getName() == null || req.getName().isBlank())
            return ResponseEntity.badRequest().build();

        NoteTemplate t = new NoteTemplate();
        t.setName(req.getName());
        t.setDescription(req.getDescription());
        t.setContent(req.getContent() != null ? req.getContent() : "");
        t.setVariables(req.getVariables() != null ? String.join(",", req.getVariables()) : null);
        t.setOwnerId(userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(NoteTemplateDto.from(repository.save(t)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<NoteTemplateDto> update(
            @PathVariable Long id,
            @RequestBody CreateTemplateRequest req,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        return repository.findById(id)
            .filter(t -> t.getOwnerId() == null || t.getOwnerId().equals(userId))
            .map(t -> {
                if (req.getName() != null) t.setName(req.getName());
                if (req.getDescription() != null) t.setDescription(req.getDescription());
                if (req.getContent() != null) t.setContent(req.getContent());
                if (req.getVariables() != null) t.setVariables(String.join(",", req.getVariables()));
                return ResponseEntity.ok(NoteTemplateDto.from(repository.save(t)));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        var found = repository.findById(id)
            .filter(t -> t.getOwnerId() == null || t.getOwnerId().equals(userId));
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        repository.delete(found.get());
        return ResponseEntity.noContent().build();
    }

    /**
     * Apply a template, substituting built-in and caller-supplied variables.
     * Built-in variables: {{date}}, {{title}}.
     */
    @PostMapping("/{id}/apply")
    public ResponseEntity<Map<String, String>> apply(
            @PathVariable Long id,
            @RequestBody Map<String, String> variables) {
        return repository.findById(id)
            .map(t -> {
                String rendered = t.getContent();
                // Built-in substitutions
                rendered = rendered.replace("{{date}}", LocalDate.now().toString());
                // Caller-provided substitutions
                for (Map.Entry<String, String> entry : variables.entrySet()) {
                    rendered = rendered.replace("{{" + entry.getKey() + "}}", entry.getValue());
                }
                return ResponseEntity.ok(Map.of("content", rendered, "name", t.getName()));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    public static class CreateTemplateRequest {
        private String name;
        private String description;
        private String content;
        private List<String> variables;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
        public List<String> getVariables() { return variables; }
        public void setVariables(List<String> variables) { this.variables = variables; }
    }
}

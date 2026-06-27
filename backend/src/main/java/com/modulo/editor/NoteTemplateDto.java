package com.modulo.editor;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

public class NoteTemplateDto {

    private Long id;
    private String name;
    private String description;
    private String content;
    private List<String> variables;
    private String ownerId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public NoteTemplateDto() {}

    public static NoteTemplateDto from(NoteTemplate t) {
        NoteTemplateDto dto = new NoteTemplateDto();
        dto.id = t.getId();
        dto.name = t.getName();
        dto.description = t.getDescription();
        dto.content = t.getContent();
        dto.variables = t.getVariables() != null && !t.getVariables().isBlank()
            ? Arrays.asList(t.getVariables().split(","))
            : List.of();
        dto.ownerId = t.getOwnerId();
        dto.createdAt = t.getCreatedAt();
        dto.updatedAt = t.getUpdatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public List<String> getVariables() { return variables; }
    public void setVariables(List<String> variables) { this.variables = variables; }
    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}

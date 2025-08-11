package com.modulo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO for handling edit conflicts in notes
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConflictResolutionDto {
    
    private Long noteId;
    private String currentTitle;
    private String currentContent;
    private String incomingTitle;
    private String incomingContent;
    private List<String> currentTagNames;
    private List<String> incomingTagNames;
    private LocalDateTime lastModified;
    private LocalDateTime incomingTimestamp;
    private String lastEditor;
    private String currentEditor;
    private Long expectedVersion;
    private Long actualVersion;
    
    /**
     * Indicates if there's a conflict between current and incoming changes
     */
    public boolean hasConflict() {
        return !expectedVersion.equals(actualVersion);
    }
    
    /**
     * Indicates if the title has changed
     */
    public boolean hasTitleConflict() {
        return currentTitle != null && incomingTitle != null && 
               !currentTitle.equals(incomingTitle);
    }
    
    /**
     * Indicates if the content has changed
     */
    public boolean hasContentConflict() {
        return currentContent != null && incomingContent != null && 
               !currentContent.equals(incomingContent);
    }
    
    /**
     * Indicates if tags have changed
     */
    public boolean hasTagConflict() {
        if (currentTagNames == null && incomingTagNames == null) return false;
        if (currentTagNames == null || incomingTagNames == null) return true;
        return !currentTagNames.containsAll(incomingTagNames) || 
               !incomingTagNames.containsAll(currentTagNames);
    }
}

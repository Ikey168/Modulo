package com.modulo.plugin.api.renderer;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Output from a note renderer containing the rendered content and metadata
 */
public class RendererOutput {
    
    private final String content;
    private final String mimeType;
    private final Map<String, Object> metadata;
    private final LocalDateTime generatedAt;
    
    public RendererOutput(String content, String mimeType) {
        this(content, mimeType, Map.of());
    }
    
    public RendererOutput(String content, String mimeType, Map<String, Object> metadata) {
        this.content = content;
        this.mimeType = mimeType;
        this.metadata = metadata;
        this.generatedAt = LocalDateTime.now();
    }
    
    /**
     * Get the rendered content
     * @return Rendered content (HTML, JSON, SVG, etc.)
     */
    public String getContent() {
        return content;
    }
    
    /**
     * Get the MIME type of the rendered content
     * @return MIME type string
     */
    public String getMimeType() {
        return mimeType;
    }
    
    /**
     * Get additional metadata about the rendered content
     * @return Metadata map
     */
    public Map<String, Object> getMetadata() {
        return metadata;
    }
    
    /**
     * Get when this output was generated
     * @return Generation timestamp
     */
    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }
    
    /**
     * Check if the output is interactive
     * @return true if the rendered content supports user interaction
     */
    public boolean isInteractive() {
        return Boolean.TRUE.equals(metadata.get("interactive"));
    }
    
    /**
     * Get the size estimate of the rendered content
     * @return Size in bytes, or -1 if unknown
     */
    public long getContentSize() {
        return content != null ? content.getBytes().length : -1;
    }
    
    @Override
    public String toString() {
        return String.format("RendererOutput{mimeType='%s', size=%d, interactive=%s}", 
                           mimeType, getContentSize(), isInteractive());
    }
}

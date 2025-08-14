package com.modulo.plugin.api;

import java.util.List;
import java.util.Map;

/**
 * Search criteria for note queries
 */
public class SearchCriteria {
    private String query;
    private List<String> tags;
    private Long userId;
    private String contentType;
    private Map<String, Object> filters;
    private int limit = 10;
    private int offset = 0;
    private String sortBy = "updatedAt";
    private String sortOrder = "DESC";
    
    // Constructors
    public SearchCriteria() {}
    
    public SearchCriteria(String query) {
        this.query = query;
    }
    
    // Getters and Setters
    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }
    
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    
    public Map<String, Object> getFilters() { return filters; }
    public void setFilters(Map<String, Object> filters) { this.filters = filters; }
    
    public int getLimit() { return limit; }
    public void setLimit(int limit) { this.limit = limit; }
    
    public int getOffset() { return offset; }
    public void setOffset(int offset) { this.offset = offset; }
    
    public String getSortBy() { return sortBy; }
    public void setSortBy(String sortBy) { this.sortBy = sortBy; }
    
    public String getSortOrder() { return sortOrder; }
    public void setSortOrder(String sortOrder) { this.sortOrder = sortOrder; }
    
    // Builder pattern methods
    public SearchCriteria withQuery(String query) {
        this.query = query;
        return this;
    }
    
    public SearchCriteria withTags(List<String> tags) {
        this.tags = tags;
        return this;
    }
    
    public SearchCriteria withUserId(Long userId) {
        this.userId = userId;
        return this;
    }
    
    public SearchCriteria withLimit(int limit) {
        this.limit = limit;
        return this;
    }
    
    public SearchCriteria withOffset(int offset) {
        this.offset = offset;
        return this;
    }
}

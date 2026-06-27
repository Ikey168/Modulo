package com.modulo.graph.dto;

/** A note whose text mentions the current note's title but does not yet link it (#252). */
public class UnlinkedMentionDto {
    private Long id;
    private String title;
    private String snippet;
    private String matchedText;

    public UnlinkedMentionDto() {}

    public UnlinkedMentionDto(Long id, String title, String snippet, String matchedText) {
        this.id = id;
        this.title = title;
        this.snippet = snippet;
        this.matchedText = matchedText;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSnippet() { return snippet; }
    public void setSnippet(String snippet) { this.snippet = snippet; }

    public String getMatchedText() { return matchedText; }
    public void setMatchedText(String matchedText) { this.matchedText = matchedText; }
}

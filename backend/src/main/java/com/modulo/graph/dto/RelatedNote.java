package com.modulo.graph.dto;

/** A structurally-related note plus its shared-neighbor score (#253). */
public class RelatedNote {
    private Long id;
    private String title;
    private int score;
    private String snippet;

    public RelatedNote() {}

    public RelatedNote(Long id, String title, int score) {
        this.id = id;
        this.title = title;
        this.score = score;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public String getSnippet() { return snippet; }
    public void setSnippet(String snippet) { this.snippet = snippet; }
}

package com.modulo.graph.dto;

/** A note linking to the current note, with a content snippet (#251). */
public class BacklinkDto {
    private Long id;
    private String title;
    private String snippet;

    public BacklinkDto() {}

    public BacklinkDto(Long id, String title, String snippet) {
        this.id = id;
        this.title = title;
        this.snippet = snippet;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSnippet() { return snippet; }
    public void setSnippet(String snippet) { this.snippet = snippet; }
}

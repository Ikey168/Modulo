package com.modulo.service;

import org.commonmark.Extension;
import org.commonmark.ext.autolink.AutolinkExtension;
import org.commonmark.ext.gfm.tables.TablesExtension;
import org.commonmark.node.Node;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
public class MarkdownService {

    private final Parser parser;
    private final HtmlRenderer renderer;

    public MarkdownService() {
        // Configure extensions for GitHub Flavored Markdown features
        List<Extension> extensions = Arrays.asList(
                TablesExtension.create(),
                AutolinkExtension.create()
        );

        // Create parser and renderer with extensions
        this.parser = Parser.builder()
                .extensions(extensions)
                .build();

        this.renderer = HtmlRenderer.builder()
                .extensions(extensions)
                .build();
    }

    /**
     * Converts Markdown text to HTML
     * @param markdown The Markdown text to convert
     * @return The rendered HTML
     */
    public String markdownToHtml(String markdown) {
        if (markdown == null || markdown.trim().isEmpty()) {
            return "";
        }

        Node document = parser.parse(markdown);
        return renderer.render(document);
    }

    /**
     * Sanitizes markdown content for safe storage
     * @param markdown The markdown content to sanitize
     * @return Sanitized markdown content
     */
    public String sanitizeMarkdown(String markdown) {
        if (markdown == null) {
            return "";
        }
        // Basic sanitization - can be enhanced with more sophisticated sanitization
        return markdown.trim();
    }
}

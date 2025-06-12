package com.modulo.controller;

import com.modulo.service.MarkdownService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/markdown")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"}) // Allow specific frontend origins
public class MarkdownController {

    private final MarkdownService markdownService;

    public MarkdownController(MarkdownService markdownService) {
        this.markdownService = markdownService;
    }

    /**
     * Converts Markdown text to HTML for live preview
     * @param request Map containing the markdown content
     * @return ResponseEntity with the rendered HTML
     */
    @PostMapping("/preview")
    public ResponseEntity<Map<String, String>> previewMarkdown(@RequestBody Map<String, String> request) {
        try {
            String markdown = request.get("markdown");
            if (markdown == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Markdown content is required"));
            }

            String html = markdownService.markdownToHtml(markdown);
            return ResponseEntity.ok(Map.of("html", html));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to process markdown: " + e.getMessage()));
        }
    }

    /**
     * Validates and sanitizes markdown content
     * @param request Map containing the markdown content
     * @return ResponseEntity with the sanitized markdown
     */
    @PostMapping("/sanitize")
    public ResponseEntity<Map<String, String>> sanitizeMarkdown(@RequestBody Map<String, String> request) {
        try {
            String markdown = request.get("markdown");
            if (markdown == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Markdown content is required"));
            }

            String sanitized = markdownService.sanitizeMarkdown(markdown);
            return ResponseEntity.ok(Map.of("sanitized", sanitized));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to sanitize markdown: " + e.getMessage()));
        }
    }
}

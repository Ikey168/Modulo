package com.modulo.editor;

import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import lombok.RequiredArgsConstructor;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@CrossOrigin(originPatterns = "*")
@RequiredArgsConstructor
public class NoteExportController {

    private static final Logger log = LoggerFactory.getLogger(NoteExportController.class);
    private static final Pattern WIKI_LINK = Pattern.compile("\\[\\[([^\\]]+)]]");

    private final NoteRepository noteRepository;

    /** Export a single note as raw Markdown. */
    @GetMapping("/api/notes/{id}/export/markdown")
    public ResponseEntity<byte[]> exportMarkdown(@PathVariable Long id,
                                                  @RequestParam(defaultValue = "false") boolean resolveLinks) {
        return noteRepository.findById(id).map(note -> {
            String content = buildMarkdown(note, resolveLinks);
            String filename = sanitizeFilename(note.getTitle()) + ".md";
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/markdown; charset=UTF-8"))
                .body(content.getBytes(StandardCharsets.UTF_8));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Export a single note as print-ready HTML (open in browser → Ctrl+P → Save as PDF). */
    @GetMapping("/api/notes/{id}/export/html")
    public ResponseEntity<String> exportHtml(@PathVariable Long id,
                                              @RequestParam(defaultValue = "false") boolean resolveLinks) {
        return noteRepository.findById(id).map(note -> {
            String markdown = buildMarkdown(note, resolveLinks);
            String html = markdownToHtml(markdown);
            String page = wrapInPrintPage(note.getTitle(), html);
            String filename = sanitizeFilename(note.getTitle()) + ".html";
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(MediaType.TEXT_HTML)
                .body(page);
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Bulk export: all notes as a ZIP of Markdown files. */
    @GetMapping("/api/notes/export/zip")
    public ResponseEntity<byte[]> exportZip(
            @RequestParam(required = false) List<Long> ids,
            @RequestParam(defaultValue = "false") boolean resolveLinks) {
        List<Note> notes = (ids == null || ids.isEmpty())
            ? noteRepository.findAll()
            : noteRepository.findAllById(ids);

        if (notes.isEmpty()) return ResponseEntity.noContent().build();

        try {
            byte[] zip = buildZip(notes, resolveLinks);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"notes-export-" + LocalDate.now() + ".zip\"")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(zip);
        } catch (IOException e) {
            log.error("Failed to build ZIP export", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private String buildMarkdown(Note note, boolean resolveLinks) {
        StringBuilder sb = new StringBuilder();
        sb.append("# ").append(note.getTitle()).append("\n\n");
        if (note.getTags() != null && !note.getTags().isEmpty()) {
            String tags = note.getTags().stream()
                .map(t -> "#" + t.getName())
                .collect(Collectors.joining(" "));
            sb.append("> Tags: ").append(tags).append("\n\n");
        }
        String body = note.getContent() != null ? note.getContent() : "";
        if (resolveLinks) body = resolveWikiLinks(body);
        sb.append(body);
        return sb.toString();
    }

    private String resolveWikiLinks(String content) {
        Matcher m = WIKI_LINK.matcher(content);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String title = m.group(1);
            // Try to find the note by title and replace with Markdown link
            noteRepository.findByTitleOrContentContainingIgnoreCase(title)
                .stream()
                .filter(n -> title.equalsIgnoreCase(n.getTitle()))
                .findFirst()
                .ifPresentOrElse(
                    n -> m.appendReplacement(sb, "[" + title + "](#note-" + n.getId() + ")"),
                    ()  -> m.appendReplacement(sb, title)
                );
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String markdownToHtml(String markdown) {
        Parser parser = Parser.builder().build();
        HtmlRenderer renderer = HtmlRenderer.builder().build();
        return renderer.render(parser.parse(markdown));
    }

    private String wrapInPrintPage(String title, String body) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <title>%s</title>
              <style>
                body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; color: #111; line-height: 1.6; }
                h1, h2, h3 { color: #1a1a1a; }
                pre, code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
                pre { padding: 12px; overflow-x: auto; }
                blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 1rem; color: #555; }
                table { border-collapse: collapse; width: 100%%; }
                th, td { border: 1px solid #ddd; padding: 8px; }
                @media print { body { margin: 20px; } a[href]:after { content: none; } }
              </style>
            </head>
            <body>
            %s
            </body>
            </html>
            """.formatted(escapeHtml(title), body);
    }

    private byte[] buildZip(List<Note> notes, boolean resolveLinks) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(baos)) {
            for (Note note : notes) {
                String content = buildMarkdown(note, resolveLinks);
                String filename = sanitizeFilename(note.getTitle()) + "-" + note.getId() + ".md";
                ZipEntry entry = new ZipEntry(filename);
                zip.putNextEntry(entry);
                zip.write(content.getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return baos.toByteArray();
    }

    private static String sanitizeFilename(String title) {
        if (title == null || title.isBlank()) return "note";
        return title.trim().replaceAll("[^a-zA-Z0-9_\\-]", "_").replaceAll("_+", "_");
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}

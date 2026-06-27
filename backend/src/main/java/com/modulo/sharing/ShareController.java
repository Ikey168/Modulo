package com.modulo.sharing;

import com.modulo.audit.AuditEventService;
import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import lombok.RequiredArgsConstructor;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@CrossOrigin(originPatterns = "*")
@RequiredArgsConstructor
public class ShareController {

    private static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder();
    private static final Parser MD_PARSER             = Parser.builder().build();
    private static final HtmlRenderer MD_RENDERER     = HtmlRenderer.builder().build();

    private final ShareTokenRepository tokenRepository;
    private final NoteRepository noteRepository;
    private final AuditEventService auditService;

    // ── Owner management ────────────────────────────────────────────────────

    /** POST /api/notes/{noteId}/shares — create a share link */
    @PostMapping("/api/notes/{noteId}/shares")
    public ResponseEntity<ShareTokenDto> create(
            @PathVariable Long noteId,
            @RequestBody CreateShareRequest req,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {

        if (noteRepository.findById(noteId).isEmpty()) return ResponseEntity.notFound().build();

        ShareToken token = new ShareToken();
        token.setNoteId(noteId);
        token.setOwnerId(userId);

        if (req.getExpiresInHours() != null && req.getExpiresInHours() > 0) {
            token.setExpiresAt(Instant.now().plus(req.getExpiresInHours(), ChronoUnit.HOURS));
        }
        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            token.setPasswordHash(BCRYPT.encode(req.getPassword()));
        }

        tokenRepository.save(token);
        auditService.record("SHARE_CREATED", noteId, userId, null, "ALLOW", null,
                "share_token=" + token.getToken());
        return ResponseEntity.status(HttpStatus.CREATED).body(ShareTokenDto.from(token));
    }

    /** GET /api/notes/{noteId}/shares — list all links for a note */
    @GetMapping("/api/notes/{noteId}/shares")
    public ResponseEntity<List<ShareTokenDto>> list(
            @PathVariable Long noteId,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {

        List<ShareTokenDto> tokens = tokenRepository.findByNoteIdOrderByCreatedAtDesc(noteId)
            .stream().map(ShareTokenDto::from).toList();
        return ResponseEntity.ok(tokens);
    }

    /** DELETE /api/shares/{tokenId} — revoke a link */
    @DeleteMapping("/api/shares/{tokenId}")
    public ResponseEntity<Void> revoke(
            @PathVariable Long tokenId,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {

        var found = tokenRepository.findById(tokenId);
        if (found.isEmpty()) return ResponseEntity.notFound().build();

        ShareToken t = found.get();
        t.setRevoked(true);
        tokenRepository.save(t);
        auditService.record("SHARE_REVOKED", t.getNoteId(), userId, null, "ALLOW", null,
                "token_id=" + tokenId);
        return ResponseEntity.noContent().build();
    }

    // ── Public render ────────────────────────────────────────────────────────

    /**
     * GET /api/s/{token} — resolve a share token and render the note.
     * Optional ?password= query param for password-protected links.
     * Returns read-only HTML suitable for embedding or direct viewing.
     */
    @GetMapping(value = "/api/s/{token}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> renderShared(
            @PathVariable String token,
            @RequestParam(required = false) String password,
            HttpServletRequest request) {

        Optional<ShareToken> found = tokenRepository.findByToken(token);
        if (found.isEmpty()) return notFoundHtml();

        ShareToken t = found.get();

        if (t.isRevoked()) {
            return errorHtml("This link has been revoked.");
        }
        if (t.isExpired()) {
            return errorHtml("This link has expired.");
        }
        if (t.getPasswordHash() != null) {
            if (password == null || !BCRYPT.matches(password, t.getPasswordHash())) {
                return passwordPromptHtml(token);
            }
        }

        Optional<Note> noteOpt = noteRepository.findById(t.getNoteId());
        if (noteOpt.isEmpty()) return notFoundHtml();

        Note note = noteOpt.get();
        String ip = getClientIp(request);
        auditService.record("SHARE_VIEWED", note.getId(), null, null, "ALLOW", ip,
                "token=" + token);

        return ResponseEntity.ok(buildNoteHtml(note));
    }

    /**
     * GET /api/s/{token}/meta — return token metadata (expiry, hasPassword)
     * without revealing the note content. Used by the frontend share panel.
     */
    @GetMapping("/api/s/{token}/meta")
    public ResponseEntity<Map<String, Object>> tokenMeta(@PathVariable String token) {
        return tokenRepository.findByToken(token)
            .map(t -> ResponseEntity.ok(Map.<String, Object>of(
                "active",      t.isActive(),
                "revoked",     t.isRevoked(),
                "expired",     t.isExpired(),
                "hasPassword", t.getPasswordHash() != null,
                "expiresAt",   t.getExpiresAt() != null ? t.getExpiresAt().toString() : ""
            )))
            .orElse(ResponseEntity.notFound().build());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private String buildNoteHtml(Note note) {
        String mdContent = note.getContent() != null ? note.getContent() : "";
        String bodyHtml  = MD_RENDERER.render(MD_PARSER.parse(mdContent));
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>%s — Modulo</title>
              <style>
                body{font-family:Georgia,serif;max-width:720px;margin:48px auto;padding:0 16px;color:#111;line-height:1.7}
                h1{font-size:2rem;margin-bottom:.25rem}
                .meta{font-size:12px;color:#888;margin-bottom:2rem}
                pre,code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-family:monospace}
                pre{padding:12px;overflow-x:auto}
                blockquote{border-left:4px solid #ccc;margin:0;padding-left:1rem;color:#555}
                img{max-width:100%%}
                .badge{display:inline-block;padding:2px 8px;border-radius:12px;background:#e0f2fe;color:#0369a1;font-size:12px;font-family:sans-serif}
              </style>
            </head>
            <body>
              <h1>%s</h1>
              <p class="meta">
                <span class="badge">Read-only shared note</span>
                %s
              </p>
              %s
            </body>
            </html>
            """.formatted(
                esc(note.getTitle()),
                esc(note.getTitle()),
                buildTagLine(note),
                bodyHtml
        );
    }

    private String buildTagLine(Note note) {
        if (note.getTags() == null || note.getTags().isEmpty()) return "";
        String tags = note.getTags().stream()
            .map(t -> "<span class=\"badge\">#" + esc(t.getName()) + "</span>")
            .reduce("", (a, b) -> a + " " + b);
        return "Tags: " + tags;
    }

    private ResponseEntity<String> notFoundHtml() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .contentType(MediaType.TEXT_HTML)
            .body(wrapPage("Not Found", "<p>This share link does not exist.</p>"));
    }

    private ResponseEntity<String> errorHtml(String message) {
        return ResponseEntity.status(HttpStatus.GONE)
            .contentType(MediaType.TEXT_HTML)
            .body(wrapPage("Link Unavailable", "<p>" + esc(message) + "</p>"));
    }

    private ResponseEntity<String> passwordPromptHtml(String token) {
        String form = """
            <p>This note is password protected.</p>
            <form method="get" action="/api/s/%s">
              <input type="password" name="password" placeholder="Enter password" autofocus
                     style="padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;margin-right:8px">
              <button type="submit" style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer">
                View Note
              </button>
            </form>
            """.formatted(esc(token));
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .contentType(MediaType.TEXT_HTML)
            .body(wrapPage("Password Required", form));
    }

    private static String wrapPage(String title, String body) {
        return """
            <!DOCTYPE html><html><head><meta charset="UTF-8"><title>%s — Modulo</title>
            <style>body{font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px;color:#111}</style>
            </head><body><h2>%s</h2>%s</body></html>
            """.formatted(esc(title), esc(title), body);
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private static String getClientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        return (xff != null && !xff.isBlank()) ? xff.split(",")[0].trim() : req.getRemoteAddr();
    }

    // ── request/response types ───────────────────────────────────────────────

    public static class CreateShareRequest {
        private Integer expiresInHours;
        private String password;
        public Integer getExpiresInHours() { return expiresInHours; }
        public void setExpiresInHours(Integer expiresInHours) { this.expiresInHours = expiresInHours; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }
}

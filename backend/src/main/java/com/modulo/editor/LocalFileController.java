package com.modulo.editor;

import com.modulo.entity.Attachment;
import com.modulo.entity.Note;
import com.modulo.repository.AttachmentRepository;
import com.modulo.repository.NoteRepository;
import com.modulo.util.LogSanitizer;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Local-filesystem fallback for attachment uploads — no Azure required.
 * Files are stored under {@code modulo.upload.dir} and served back directly.
 */
@RestController
@CrossOrigin(originPatterns = "*")
@RequiredArgsConstructor
public class LocalFileController {

    private static final Logger log = LoggerFactory.getLogger(LocalFileController.class);

    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024L; // 20 MB
    private static final List<String> ALLOWED_TYPES = List.of(
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
        "application/pdf", "text/plain", "text/markdown",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    private final NoteRepository noteRepository;
    private final AttachmentRepository attachmentRepository;

    @Value("${modulo.upload.dir:${java.io.tmpdir}/modulo-uploads}")
    private String uploadDir;

    @PostMapping(value = "/api/notes/{noteId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentInfo> upload(
            @PathVariable Long noteId,
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {

        Note note = noteRepository.findById(noteId).orElse(null);
        if (note == null) return ResponseEntity.notFound().build();

        if (file.isEmpty()) return ResponseEntity.badRequest().build();
        if (file.getSize() > MAX_FILE_SIZE)
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();

        String contentType = file.getContentType();
        if (contentType == null || ALLOWED_TYPES.stream().noneMatch(t -> t.equalsIgnoreCase(contentType)))
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).build();

        try {
            Path dir = Paths.get(uploadDir, String.valueOf(noteId));
            Files.createDirectories(dir);

            String ext = "";
            String orig = file.getOriginalFilename();
            if (orig != null && orig.contains("."))
                ext = orig.substring(orig.lastIndexOf('.'));
            String storedName = UUID.randomUUID() + ext;
            Path dest = dir.resolve(storedName);
            Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

            String localUrl = "/api/files/" + noteId + "/" + storedName;

            Attachment att = Attachment.builder()
                .originalFilename(orig)
                .blobName(storedName)
                .contentType(contentType)
                .fileSize(file.getSize())
                .containerName("local")
                .blobUrl(localUrl)
                .uploadedAt(LocalDateTime.now())
                .uploadedBy(userId)
                .note(note)
                .isActive(true)
                .build();
            att = attachmentRepository.save(att);

            log.info("Saved local attachment {} for note {}", LogSanitizer.sanitize(storedName), LogSanitizer.sanitizeId(noteId));
            return ResponseEntity.status(HttpStatus.CREATED).body(new AttachmentInfo(att, localUrl));

        } catch (IOException e) {
            log.error("Failed to store file for note {}", LogSanitizer.sanitizeId(noteId), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/notes/{noteId}/files")
    public List<AttachmentInfo> list(@PathVariable Long noteId) {
        return attachmentRepository.findByNoteIdAndIsActiveTrue(noteId)
            .stream()
            .map(a -> new AttachmentInfo(a, a.getBlobUrl()))
            .collect(Collectors.toList());
    }

    @GetMapping("/api/files/{noteId}/{filename:.+}")
    public ResponseEntity<Resource> serve(@PathVariable Long noteId, @PathVariable String filename) {
        Path file = Paths.get(uploadDir, String.valueOf(noteId), filename);
        if (!Files.exists(file)) return ResponseEntity.notFound().build();
        try {
            Resource resource = new FileSystemResource(file);
            String contentType = Files.probeContentType(file);
            if (contentType == null) contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/api/notes/{noteId}/files/{attachmentId}")
    public ResponseEntity<Void> delete(
            @PathVariable Long noteId,
            @PathVariable Long attachmentId,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        var found = attachmentRepository.findById(attachmentId)
            .filter(a -> a.getNote() != null && a.getNote().getId().equals(noteId));
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        var attachment = found.get();
        attachment.setIsActive(false);
        attachmentRepository.save(attachment);
        try {
            Files.deleteIfExists(Paths.get(uploadDir, String.valueOf(noteId), attachment.getBlobName()));
        } catch (IOException ignored) {}
        return ResponseEntity.noContent().build();
    }

    public record AttachmentInfo(
        Long id,
        String originalFilename,
        String contentType,
        Long fileSize,
        String url,
        boolean isImage
    ) {
        AttachmentInfo(Attachment a, String url) {
            this(a.getId(), a.getOriginalFilename(), a.getContentType(),
                 a.getFileSize(), url,
                 a.getContentType() != null && a.getContentType().startsWith("image/"));
        }
    }
}

package com.modulo.files;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Raw-body upload/download of plugin files. Bytes are bounded before they are buffered. */
@RestController
@RequestMapping("/api/workspaces/{workspace}/files")
public class WorkspaceFileController {
  // Types a browser may render in place. Everything else is forced to download.
  private static final Set<String> INLINE =
      Set.of("image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain",
          "audio/mpeg", "audio/ogg", "audio/webm", "audio/mp4", "video/mp4", "video/webm");
  private final WorkspaceFileStore store;

  public WorkspaceFileController(WorkspaceFileStore store) {
    this.store = store;
  }

  @GetMapping(produces = "application/json")
  public ResponseEntity<List<WorkspaceFileStore.FileMeta>> list(@PathVariable String workspace) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(store.list(workspace));
  }

  @PutMapping(value = "/{id}", produces = "application/json")
  public ResponseEntity<WorkspaceFileStore.FileMeta> put(
      @PathVariable String workspace,
      @PathVariable String id,
      @RequestParam(required = false) String name,
      HttpServletRequest request)
      throws IOException {
    byte[] bytes = request.getInputStream().readNBytes(WorkspaceFileStore.MAX_FILE_BYTES + 1);
    if (bytes.length > WorkspaceFileStore.MAX_FILE_BYTES) {
      throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE");
    }
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(store.put(workspace, id, name, request.getContentType(), bytes));
  }

  @GetMapping("/{id}")
  public ResponseEntity<byte[]> get(@PathVariable String workspace, @PathVariable String id) {
    WorkspaceFileStore.StoredFile file =
        store
            .get(workspace, id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND"));
    String type = file.meta().contentType().toLowerCase().split(";")[0].trim();
    boolean inline = INLINE.contains(type);
    String encoded = URLEncoder.encode(file.meta().name(), StandardCharsets.UTF_8).replace("+", "%20");
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .contentType(inline ? MediaType.parseMediaType(type) : MediaType.APPLICATION_OCTET_STREAM)
        .header(HttpHeaders.CONTENT_DISPOSITION,
            (inline ? "inline" : "attachment") + "; filename*=UTF-8''" + encoded)
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "sandbox")
        .header("X-File-Content-Type", file.meta().contentType())
        .body(file.content());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable String workspace, @PathVariable String id) {
    return store.delete(workspace, id)
        ? ResponseEntity.noContent().build()
        : ResponseEntity.notFound().build();
  }
}

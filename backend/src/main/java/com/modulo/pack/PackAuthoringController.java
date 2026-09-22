package com.modulo.pack;

import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/pack-studio")
@PreAuthorize("isAuthenticated()")
public class PackAuthoringController {
  private final PackAuthoringService studio;
  private final AuthenticatedUserService users;

  public PackAuthoringController(PackAuthoringService studio, AuthenticatedUserService users) {
    this.studio = studio;
    this.users = users;
  }

  public record SourceInput(String source) {}

  public record DraftInput(UUID id, long revision, String source) {}

  public record PublishInput(String source, String expectedHash, boolean publicConfirmation) {}

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> failure(ResponseStatusException failure) {
    return ResponseEntity.status(failure.getStatus())
        .body(Map.of("code", Objects.toString(failure.getReason(), "AUTHORING_FAILED")));
  }

  @PostMapping("/preview")
  public Map<String, Object> preview(@RequestBody SourceInput input) {
    return studio.preview(input.source());
  }

  @PostMapping("/drafts")
  public Map<String, Object> save(@RequestBody DraftInput input) {
    return studio.saveDraft(users.requireUserId(), input.id(), input.revision(), input.source());
  }

  @GetMapping("/drafts")
  public List<Map<String, Object>> drafts() {
    return studio.drafts(users.requireUserId());
  }

  @GetMapping("/drafts/{id}")
  public Map<String, Object> draft(@PathVariable UUID id) {
    return studio.draft(id, users.requireUserId());
  }

  @DeleteMapping("/drafts/{id}")
  public void delete(@PathVariable UUID id, @RequestParam long revision) {
    studio.deleteDraft(id, users.requireUserId(), revision);
  }

  @PostMapping("/publish")
  public Map<String, Object> publish(@RequestBody PublishInput input) {
    return studio.publish(
        users.requireUserId(), input.source(), input.expectedHash(), input.publicConfirmation());
  }

  @GetMapping("/publications")
  public List<Map<String, Object>> publications() {
    return studio.publications(users.requireUserId());
  }

  @GetMapping("/publications/{id}/source")
  public ResponseEntity<String> source(@PathVariable UUID id) {
    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_JSON)
        .header("Content-Disposition", "attachment; filename=pack-" + id + ".json")
        .cacheControl(CacheControl.noStore())
        .body(studio.publishedSource(id, users.requireUserId()));
  }
}

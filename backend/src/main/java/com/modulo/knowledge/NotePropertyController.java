package com.modulo.knowledge;

import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/note-properties")
@PreAuthorize("isAuthenticated()")
public class NotePropertyController {
  private final NotePropertyService properties;
  private final AuthenticatedUserService users;

  public NotePropertyController(NotePropertyService properties, AuthenticatedUserService users) {
    this.properties = properties;
    this.users = users;
  }

  public record Read(List<Long> noteIds) {}

  public record Write(List<NotePropertyService.Change> changes) {}

  public record Query(List<NotePropertyService.Filter> filters, long after, int limit) {}

  @GetMapping("/definitions")
  public Object definitions() {
    return properties.definitions(users.requireUserId());
  }

  @PutMapping("/definitions")
  public Object define(@RequestBody NotePropertyService.Definition body) {
    return properties.define(users.requireUserId(), body);
  }

  @PostMapping("/read")
  public Object read(@RequestBody Read body) {
    return properties.read(users.requireUserId(), body.noteIds());
  }

  @PostMapping("/write")
  public Object write(@RequestBody Write body) {
    return properties.write(users.requireUserId(), body.changes());
  }

  @PostMapping("/query")
  public Object query(@RequestBody Query body) {
    return properties.query(users.requireUserId(), body.filters(), body.after(), body.limit());
  }

  public record DocumentWrite(
      NotePropertyService.Change change, String markdown, String expectedMarkdown) {}

  @PostMapping("/document")
  public Object document(@RequestBody DocumentWrite body) {
    if (body.change() == null)
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.BAD_REQUEST, "INVALID_PROPERTY_PATCH");
    return properties.writeDocument(
        users.requireUserId(), body.change(), body.markdown(), body.expectedMarkdown());
  }

  @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
  public org.springframework.http.ResponseEntity<Map<String, String>> failure(
      org.springframework.web.server.ResponseStatusException failure) {
    return org.springframework.http.ResponseEntity.status(failure.getStatus())
        .body(Map.of("code", Objects.toString(failure.getReason(), "PROPERTY_REQUEST_FAILED")));
  }
}

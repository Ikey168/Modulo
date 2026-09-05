package com.modulo.knowledge;

import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/property-queries")
@PreAuthorize("isAuthenticated()")
public class SavedPropertyQueryController {
  private final SavedPropertyQueryService queries;
  private final AuthenticatedUserService users;

  public SavedPropertyQueryController(
      SavedPropertyQueryService queries, AuthenticatedUserService users) {
    this.queries = queries;
    this.users = users;
  }

  @GetMapping
  public Object list() {
    return queries.list(users.requireUserId());
  }

  @PostMapping
  public Object save(@RequestBody SavedPropertyQueryService.Save input) {
    return queries.save(users.requireUserId(), input);
  }

  @GetMapping("/{id}")
  public Object get(@PathVariable UUID id) {
    return queries.get(users.requireUserId(), id);
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable UUID id, @RequestParam long revision) {
    queries.delete(users.requireUserId(), id, revision);
  }

  @GetMapping("/{id}/results")
  public Object run(
      @PathVariable UUID id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int limit) {
    return queries.run(users.requireUserId(), id, page, limit);
  }

  @PostMapping("/import-database")
  public Object importDatabase(@RequestBody SavedPropertyQueryService.DatabaseImport input) {
    return queries.importDatabase(users.requireUserId(), input);
  }

  @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
  public org.springframework.http.ResponseEntity<Map<String, String>> failure(
      org.springframework.web.server.ResponseStatusException failure) {
    return org.springframework.http.ResponseEntity.status(failure.getStatus())
        .body(Map.of("code", Objects.toString(failure.getReason(), "QUERY_REQUEST_FAILED")));
  }
}

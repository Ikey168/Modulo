package com.modulo.blueprint;

import com.modulo.blueprint.interpreter.BlueprintInterpreterService;
import com.modulo.repository.NoteRepository;
import com.modulo.security.AuthenticatedUserService;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Explicit, idempotent manual entry point used by executable runbooks. */
@RestController
@RequestMapping("/api/blueprints")
@PreAuthorize("isAuthenticated()")
public class ManualBlueprintController {
  private final BlueprintRepository blueprints;
  private final NoteRepository notes;
  private final AuthenticatedUserService users;
  private final BlueprintInterpreterService interpreter;

  public ManualBlueprintController(BlueprintRepository blueprints, NoteRepository notes,
      AuthenticatedUserService users, BlueprintInterpreterService interpreter) {
    this.blueprints = blueprints; this.notes = notes; this.users = users; this.interpreter = interpreter;
  }

  public record RunRequest(UUID requestId, Long noteId, String triggerId, boolean confirmed) {}

  @PostMapping("/{name}/run")
  public Map<String, Object> run(@PathVariable String name, @RequestBody RunRequest body) {
    if (body.requestId() == null || body.noteId() == null || body.noteId() < 1
        || body.triggerId() == null || body.triggerId().isBlank() || body.triggerId().length() > 128
        || !body.confirmed()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CONFIRMED_MANUAL_INPUT_REQUIRED");
    long owner = users.requireUserId();
    var blueprint = blueprints.findByName(name).filter(b -> Objects.equals(b.getOwnerId(), owner))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    var note = notes.findById(body.noteId()).filter(n -> Objects.equals(n.getUserId(), owner))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    try {
      return Map.of("runId", interpreter.fireManual(blueprint, body.triggerId(), note, body.requestId()));
    } catch (IllegalArgumentException invalid) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MANUAL_TRIGGER_UNAVAILABLE");
    }
  }
}

package com.modulo.research;

import com.fasterxml.jackson.databind.JsonNode;
import com.modulo.state.PluginStateStore;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(value = "/api/research/noesis", produces = "application/json")
public class NoesisResearchController {
  private final NoesisResearchService research;
  public NoesisResearchController(NoesisResearchService research) { this.research = research; }
  @GetMapping("/domains") public JsonNode domains() { return research.domains(); }
  @GetMapping public PluginStateStore.Page list(@RequestParam(required=false) String cursor) { return research.list(cursor); }
  @GetMapping("/{id}") public PluginStateStore.StateRecord get(@PathVariable String id) { return research.get(id); }
  @PutMapping("/{id}") public PluginStateStore.StateRecord create(@PathVariable String id, @RequestBody JsonNode body) { return research.create(id, body); }
  @PostMapping("/{id}/refresh") public PluginStateStore.StateRecord refresh(@PathVariable String id, @RequestBody JsonNode body) { return research.refresh(id, body); }
  @PostMapping("/{id}/links") public PluginStateStore.StateRecord link(@PathVariable String id, @RequestBody JsonNode body) { return research.link(id, body); }
  @PostMapping("/{id}/outputs") public PluginStateStore.StateRecord output(@PathVariable String id, @RequestBody JsonNode body) { return research.output(id, body); }
  @ExceptionHandler(PluginStateStore.VersionConflict.class)
  public ResponseEntity<?> conflict(PluginStateStore.VersionConflict e) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(java.util.Map.of("code", "STATE_VERSION_CONFLICT", "message", "Reload the current result before retrying."));
  }
}

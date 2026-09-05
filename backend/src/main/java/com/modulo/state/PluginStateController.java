package com.modulo.state;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** Authenticated host API. EXTERNAL workloads must use permission-checked host callbacks. */
@RestController
@RequestMapping(value = "/api/workspaces/{workspace}/plugin-state/{namespace}", produces = "application/json")
public class PluginStateController {
    private final PluginStateStore store;
    private static final int MAX_REQUEST_BYTES = 1_048_576 + 4096;

    public PluginStateController(PluginStateStore store) { this.store = store; }

    @GetMapping(params = "!changesAfter")
    public ResponseEntity<PluginStateStore.Page> list(@PathVariable String workspace, @PathVariable String namespace,
            @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(store.list(workspace, namespace, cursor, limit));
    }

    // A query selector avoids reserving an otherwise valid state key named "changes".
    @GetMapping(params = "changesAfter")
    public ResponseEntity<List<PluginStateStore.Change>> changes(@PathVariable String workspace, @PathVariable String namespace,
            @RequestParam long changesAfter, @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(store.changes(workspace, namespace, changesAfter, limit));
    }

    @GetMapping("/{key}")
    public ResponseEntity<PluginStateStore.StateRecord> get(@PathVariable String workspace,
            @PathVariable String namespace, @PathVariable String key) {
        return response(store.get(workspace, namespace, key));
    }

    @PutMapping(value = "/{key}", consumes = "application/json")
    @Operation(requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true,
            content = @Content(schema = @Schema(implementation = PluginStateStore.WriteRequest.class))))
    public ResponseEntity<PluginStateStore.StateRecord> put(@PathVariable String workspace,
            @PathVariable String namespace, @PathVariable String key, HttpServletRequest request) throws IOException {
        // Bound bytes before JSON parsing, including chunked requests with no Content-Length.
        byte[] bytes = request.getInputStream().readNBytes(MAX_REQUEST_BYTES + 1);
        if (bytes.length > MAX_REQUEST_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "STATE_PAYLOAD_TOO_LARGE");
        }
        String body;
        try {
            body = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "STATE_INVALID_UTF8");
        }
        return response(store.putJson(workspace, namespace, key, body));
    }

    @DeleteMapping("/{key}")
    public ResponseEntity<PluginStateStore.StateRecord> delete(@PathVariable String workspace,
            @PathVariable String namespace, @PathVariable String key, @RequestParam long expectedVersion) {
        return response(store.delete(workspace, namespace, key, expectedVersion));
    }

    public record StateError(String code, Long expectedVersion, Long actualVersion,
                             PluginStateStore.StateRecord current) {}

    @ExceptionHandler(PluginStateStore.VersionConflict.class)
    public ResponseEntity<StateError> conflict(PluginStateStore.VersionConflict error) {
        return ResponseEntity.status(HttpStatus.CONFLICT).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(new StateError("STATE_VERSION_CONFLICT",
                error.expectedVersion, error.actualVersion, error.current));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<StateError> error(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatus()).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(new StateError(error.getReason(), null, null, null));
    }

    private ResponseEntity<PluginStateStore.StateRecord> response(PluginStateStore.StateRecord record) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).eTag(Long.toString(record.version())).body(record);
    }
}

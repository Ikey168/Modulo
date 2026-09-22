package com.modulo.state;

import java.nio.*;
import java.nio.charset.*;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspaces/{workspace}/plugin-state-schemas/{namespace}")
public class PluginStateSchemaController {
  private final PluginStateStore store;

  public PluginStateSchemaController(PluginStateStore store) {
    this.store = store;
  }

  @PutMapping(value = "/{id}/{version}", consumes = "application/json")
  public ResponseEntity<Void> register(
      @PathVariable String workspace,
      @PathVariable String namespace,
      @PathVariable String id,
      @PathVariable int version,
      HttpServletRequest request)
      throws java.io.IOException {
    byte[] bytes = request.getInputStream().readNBytes(16385);
    if (bytes.length > 16384)
      throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "STATE_SCHEMA_TOO_LARGE");
    try {
      store.registerSchema(
          workspace,
          namespace,
          id,
          version,
          StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString());
    } catch (CharacterCodingException invalid) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "STATE_INVALID_JSON");
    }
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }
}

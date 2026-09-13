package com.modulo.integrations.noesis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.security.AuthenticatedUserService;
import java.io.IOException;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Signed-in Modulo facade for the supported Noesis intake MCP tools. */
@RestController
@RequestMapping("/api/integrations/noesis/intake")
@PreAuthorize("isAuthenticated()")
public class NoesisIntakeController {
  private final AuthenticatedUserService users;
  private final NoesisIntakeBridge bridge;
  private final ObjectMapper json;

  public NoesisIntakeController(AuthenticatedUserService users, NoesisIntakeBridge bridge,
      ObjectMapper json) {
    this.users = users;
    this.bridge = bridge;
    this.json = json;
  }

  public record Call(String tool, JsonNode arguments) {}
  public record BridgeError(String code) {}

  @GetMapping("/preflight")
  public ResponseEntity<?> preflight() {
    if (!bridge.configured()) {
      return ResponseEntity.ok().cacheControl(CacheControl.noStore())
          .body(Map.of("available", false, "reason", "NOESIS_NOT_CONFIGURED"));
    }
    try {
      JsonNode modes = bridge.call(users.requireUserId(), "discover_intake_modes",
          json.createObjectNode());
      return ResponseEntity.ok().cacheControl(CacheControl.noStore())
          .body(Map.of("available", true, "discovery", modes));
    } catch (NoesisIntakeBridge.BridgeException error) {
      return ResponseEntity.ok().cacheControl(CacheControl.noStore())
          .body(Map.of("available", false, "reason", error.code()));
    }
  }

  @PostMapping("/call")
  public ResponseEntity<JsonNode> call(HttpServletRequest input) throws IOException {
    byte[] bytes = input.getInputStream().readNBytes(262_145);
    if (bytes.length > 262_144) {
      throw new NoesisIntakeBridge.BridgeException(HttpStatus.PAYLOAD_TOO_LARGE, "NOESIS_CALL_TOO_LARGE");
    }
    Call request;
    try { request = json.readValue(bytes, Call.class); }
    catch (IOException error) {
      throw new NoesisIntakeBridge.BridgeException(HttpStatus.BAD_REQUEST, "NOESIS_CALL_INVALID");
    }
    if (request == null || request.tool() == null) {
      throw new NoesisIntakeBridge.BridgeException(HttpStatus.BAD_REQUEST, "NOESIS_CALL_INVALID");
    }
    JsonNode result = bridge.call(users.requireUserId(), request.tool(), request.arguments());
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result);
  }

  @ExceptionHandler(NoesisIntakeBridge.BridgeException.class)
  public ResponseEntity<BridgeError> error(NoesisIntakeBridge.BridgeException error) {
    return ResponseEntity.status(error.status()).cacheControl(CacheControl.noStore())
        .body(new BridgeError(error.code()));
  }
}

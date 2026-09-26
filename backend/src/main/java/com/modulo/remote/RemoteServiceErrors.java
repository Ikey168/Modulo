package com.modulo.remote;

import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/** Remote-service failures as stable codes the client can explain (never upstream bodies or stack traces). */
@RestControllerAdvice(assignableTypes = RemoteServicesController.class)
public class RemoteServiceErrors {
  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> error(ResponseStatusException error) {
    String reason = error.getReason() == null ? "REMOTE_FAILED" : error.getReason();
    return ResponseEntity.status(error.getStatus()).cacheControl(CacheControl.noStore())
        .body(Map.of("code", reason.split(":")[0].strip()));
  }
}

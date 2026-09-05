package com.modulo.state;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(
    assignableTypes = {PluginStateGrantController.class, PluginStateSchemaController.class})
public class StateControlErrors {
  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<PluginStateController.StateError> error(ResponseStatusException error) {
    return ResponseEntity.status(error.getStatus())
        .cacheControl(CacheControl.noStore())
        .body(new PluginStateController.StateError(error.getReason(), null, null, null));
  }
}

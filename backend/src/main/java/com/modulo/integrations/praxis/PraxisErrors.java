package com.modulo.integrations.praxis;

import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Praxis failures as stable codes for the UI. Praxis' own 4xx answers (404, 409
 * {@code stale_process_attempt}, 422, 429 with Retry-After, ...) keep their status and
 * code. A 401 from Praxis means Modulo's credentials are wrong, not the user's session,
 * so it becomes 502 and never logs the user out. Upstream bodies are not passed on.
 */
@RestControllerAdvice(assignableTypes = PraxisController.class)
public class PraxisErrors {
  private static final Logger log = LoggerFactory.getLogger(PraxisErrors.class);

  @ExceptionHandler(PraxisException.class)
  public ResponseEntity<Map<String, Object>> praxis(PraxisException error) {
    int upstream = error.status();
    HttpStatus status;
    String code = error.code();
    if (upstream == 0) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      log.warn("Praxis unavailable: {}", error.getCause() == null ? error.code() : error.getCause().toString());
    } else if (upstream == 401) {
      status = HttpStatus.BAD_GATEWAY;
      code = "praxis_authentication_failed";
      log.error("Praxis rejected Modulo's client credentials (check the token and client certificate)");
    } else if (upstream == 503) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
    } else if (upstream >= 500) {
      status = HttpStatus.BAD_GATEWAY;
    } else {
      HttpStatus resolved = HttpStatus.resolve(upstream);
      status = resolved == null ? HttpStatus.BAD_GATEWAY : resolved;
    }
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("code", code);
    if (error.details() != null && upstream >= 400 && upstream < 500 && upstream != 401) body.put("details", error.details());
    ResponseEntity.BodyBuilder response = ResponseEntity.status(status).cacheControl(CacheControl.noStore());
    if (error.retryAfter() != null && error.retryAfter().matches("\\d{1,6}")) response.header("Retry-After", error.retryAfter());
    return response.body(body);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, Object>> invalid(IllegalArgumentException error) {
    String code = error.getMessage() == null || !error.getMessage().matches("[a-z_]{1,64}") ? "invalid_request" : error.getMessage();
    return ResponseEntity.badRequest().cacheControl(CacheControl.noStore()).body(Map.of("code", code));
  }
}

package com.modulo.integrations.praxis;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * A Praxis call that did not produce a usable response. {@code status} and {@code code}
 * are Praxis' own (e.g. 409 {@code stale_process_attempt}); transport and TLS failures
 * use status 0 and {@code praxis_unavailable}.
 */
public class PraxisException extends RuntimeException {
  private final int status;
  private final String code;
  private final JsonNode details;
  private final String retryAfter;

  public PraxisException(int status, String code, JsonNode details, String retryAfter) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }

  public PraxisException(String code, Throwable cause) {
    super(code, cause);
    this.status = 0;
    this.code = code;
    this.details = null;
    this.retryAfter = null;
  }

  public int status() { return status; }
  public String code() { return code; }
  public JsonNode details() { return details; }
  public String retryAfter() { return retryAfter; }
}

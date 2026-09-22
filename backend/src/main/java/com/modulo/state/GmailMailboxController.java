package com.modulo.state;

import java.time.Duration;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class GmailMailboxController {
  private final GmailMailboxService service;
  public GmailMailboxController(GmailMailboxService service) { this.service = service; }
  @GetMapping("/api/newsletters/gmail")
  public ResponseEntity<GmailMailboxService.Status> status() { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.status()); }
  @PostMapping("/api/newsletters/gmail/connect")
  public ResponseEntity<Map<String, String>> connect() {
    var start = service.start();
    var cookie = ResponseCookie.from("modulo_gmail_link", start.cookie()).secure(true).httpOnly(true).sameSite("Lax").path("/api/public/gmail").maxAge(Duration.ofMinutes(10)).build();
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header(HttpHeaders.SET_COOKIE, cookie.toString()).body(Map.of("url", start.url()));
  }
  public record Settings(String query, boolean enabled) {}
  @PutMapping("/api/newsletters/gmail")
  public ResponseEntity<Void> settings(@RequestBody Settings settings) { service.configure(settings.query(), settings.enabled()); return ResponseEntity.noContent().build(); }
  @PostMapping("/api/newsletters/gmail/sync")
  public ResponseEntity<GmailMailboxService.Status> sync() { service.syncNow(); return status(); }
  @DeleteMapping("/api/newsletters/gmail")
  public ResponseEntity<Void> disconnect() { service.disconnect(); return ResponseEntity.noContent().build(); }
  @GetMapping(value = "/api/public/gmail/callback", produces = MediaType.TEXT_HTML_VALUE)
  public ResponseEntity<String> callback(@RequestParam(required = false) String state, @RequestParam(required = false) String code, @RequestParam(required = false) String error, @CookieValue(name = "modulo_gmail_link", required = false) String cookie) {
    String message; HttpStatus status;
    try { service.callback(state, cookie, code, error); message = "Gmail is connected. Close this window and choose which newsletters to sync in Modulo."; status = HttpStatus.OK; }
    catch (RuntimeException failure) { message = "Gmail could not be connected. Close this window and start again from Modulo in the same browser."; status = HttpStatus.BAD_REQUEST; }
    return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).header("Referrer-Policy", "no-referrer").header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'").header(HttpHeaders.SET_COOKIE, ResponseCookie.from("modulo_gmail_link", "").secure(true).httpOnly(true).sameSite("Lax").path("/api/public/gmail").maxAge(0).build().toString()).body("<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Gmail connection</title><h1>Gmail connection</h1><p>" + message + "</p></html>");
  }
}

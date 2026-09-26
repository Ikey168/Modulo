package com.modulo.state;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.StringReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.regex.Pattern;
import javax.swing.text.MutableAttributeSet;
import javax.swing.text.html.*;
import javax.swing.text.html.parser.ParserDelegator;

final class GmailMessageDecoder {
  static String digest(String value) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
    catch (Exception failure) { throw new IllegalStateException("Hash unavailable"); }
  }
  static String id(String email, String messageId) { return "gmail-" + digest(email.toLowerCase() + ":" + messageId); }
  static String header(JsonNode payload, String name) {
    for (JsonNode header : payload.path("headers")) if (name.equalsIgnoreCase(header.path("name").asText())) return header.path("value").asText();
    return "";
  }
  static String textPart(JsonNode part, String mime) {
    if (!part.path("filename").asText().isBlank()) return "";
    if (mime.equals(part.path("mimeType").asText()) && part.path("body").hasNonNull("data")) {
      Charset charset = StandardCharsets.UTF_8;
      var match = Pattern.compile("charset=[\\\"]?([^;\\\" ]+)", Pattern.CASE_INSENSITIVE).matcher(header(part, "Content-Type"));
      if (match.find()) try { charset = Charset.forName(match.group(1)); } catch (Exception ignored) { }
      return new String(Base64.getUrlDecoder().decode(part.path("body").path("data").asText()), charset);
    }
    for (JsonNode child : part.path("parts")) { String body = textPart(child, mime); if (!body.isBlank()) return body; }
    return "";
  }
  static String htmlText(String html) {
    var document = org.jsoup.Jsoup.parse(html);
    document.select("script,style,iframe,object").remove();
    document.select("p,div,li,br,tr,h1,h2,h3").append("\n");
    return document.body().wholeText().trim();
  }
  static ObjectNode decode(ObjectMapper json, String email, JsonNode message) {
    JsonNode payload = message.path("payload"); String body = textPart(payload, "text/plain"); if (body.isBlank()) body = htmlText(textPart(payload, "text/html"));
    if (body.isBlank()) body = message.path("snippet").asText();
    if (body.length() > 200000) body = body.substring(0, 199900) + "\n[Message shortened. Open the original in Gmail for the remainder.]";
    String messageId = message.path("id").asText();
    ObjectNode result = json.createObjectNode(); result.put("id", id(email, messageId)); result.put("title", limit(header(payload, "Subject"), 1000, "Untitled newsletter")); result.put("sender", limit(header(payload, "From"), 1000, email));
    result.put("body", body); result.put("url", ""); result.put("receivedAt", Instant.ofEpochMilli(message.path("internalDate").asLong(System.currentTimeMillis())).toString());
    result.put("messageId", limit(header(payload, "Message-ID"), 1000, "gmail:" + email + ":" + messageId)); result.put("status", "Unread"); return result;
  }
  private static String limit(String value, int max, String fallback) { return value.isBlank() ? fallback : value.substring(0, Math.min(value.length(), max)); }
}

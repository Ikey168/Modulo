package com.modulo.remote;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Server-side equivalents of the desktop shell's network services (#495), so
 * Android and browser clients get the same workflows. Provider credentials are
 * read from {@link RemoteCredentialStore} and never leave the server; every
 * outbound request goes through {@link SafeHttpFetcher}.
 */
@Service
public class RemoteServices {
  private final SafeHttpFetcher http;
  private final RemoteCredentialStore credentials;
  private final ObjectMapper json = new ObjectMapper();

  /**
   * @param allowPrivateNetworks administrator opt-in for self-hosted services on the server's own
   *     network (a Miniflux or Radicale next to Modulo). Off by default: with it on, any signed-in
   *     user can make the server request internal addresses.
   */
  @org.springframework.beans.factory.annotation.Autowired
  public RemoteServices(RemoteCredentialStore credentials,
      @org.springframework.beans.factory.annotation.Value("${modulo.remote.allow-private-networks:false}") boolean allowPrivateNetworks) {
    this(new SafeHttpFetcher(allowPrivateNetworks), credentials);
  }

  RemoteServices(SafeHttpFetcher http, RemoteCredentialStore credentials) {
    this.http = http;
    this.credentials = credentials;
  }

  private static ResponseStatusException problem(HttpStatus status, String code) {
    return new ResponseStatusException(status, code);
  }

  private SafeHttpFetcher.Response ok(SafeHttpFetcher.Response response) {
    if (response.status() == 401 || response.status() == 403) throw problem(HttpStatus.BAD_GATEWAY, "REMOTE_AUTH_REJECTED");
    if (response.status() == 404) throw problem(HttpStatus.BAD_GATEWAY, "REMOTE_NOT_FOUND");
    if (response.status() >= 400) throw problem(HttpStatus.BAD_GATEWAY, "REMOTE_HTTP_" + response.status());
    return response;
  }

  private String credential(String key, String missingCode) {
    String value = credentials.current().get(key);
    if (value == null || value.isBlank()) throw problem(HttpStatus.PRECONDITION_FAILED, missingCode);
    return value;
  }

  private JsonNode parseJson(SafeHttpFetcher.Response response) {
    try {
      return json.readTree(response.body());
    } catch (Exception invalid) {
      throw problem(HttpStatus.BAD_GATEWAY, "REMOTE_INVALID_JSON");
    }
  }

  static String sha256(String value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception impossible) {
      throw new IllegalStateException(impossible);
    }
  }

  public List<Map<String, String>> feeds(String kind, String url) {
    if ("Miniflux".equals(kind)) {
      String token = credential("minifluxToken", "CREDENTIAL_MISSING_MINIFLUX");
      String endpoint = url.contains("/v1/") ? url : url.replaceAll("/$", "") + "/v1/entries";
      endpoint += (endpoint.contains("?") ? "&" : "?") + "status=unread&limit=250";
      JsonNode body = parseJson(ok(http.get(endpoint, Map.of("X-Auth-Token", token, "Accept", "application/json"))));
      List<Map<String, String>> items = new ArrayList<>();
      for (JsonNode entry : body.path("entries")) {
        Map<String, String> item = new LinkedHashMap<>();
        item.put("externalId", entry.path("id").asText());
        item.put("title", entry.path("title").asText("Untitled feed item"));
        item.put("url", entry.path("url").asText(""));
        item.put("source", entry.path("feed").path("title").asText(""));
        item.put("author", entry.path("author").asText(""));
        item.put("publishedAt", entry.path("published_at").asText(""));
        item.put("summary", RemoteParsers.plain(entry.path("content").asText("")));
        item.put("feedUrl", entry.path("feed").path("feed_url").asText(""));
        items.add(item);
      }
      return items;
    }
    SafeHttpFetcher.Response response = ok(http.get(url, Map.of("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml")));
    return RemoteParsers.feed(response.text(), response.finalUri().toString());
  }

  /** Fetches a page for the web archive; the caller stores the returned HTML as a workspace file. */
  public Map<String, Object> capture(String url) {
    SafeHttpFetcher.Response response = ok(http.get(url, Map.of("Accept", "text/html,application/xhtml+xml")));
    String html = response.text();
    String title = Jsoup.parse(html).title();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("title", title == null || title.isBlank() ? response.finalUri().getHost() : title);
    result.put("originalUrl", response.finalUri().toString());
    result.put("archivedAt", Instant.now().toString());
    result.put("contentHash", sha256(html));
    result.put("mimeType", response.contentType() == null ? "text/html" : response.contentType());
    result.put("sourceProvider", "Server capture");
    result.put("html", "<!-- Saved by Modulo at " + result.get("archivedAt") + " from " + result.get("originalUrl") + " -->\n" + html);
    return result;
  }

  /** Bookmarks from a Karakeep or ArchiveBox API, normalized like the desktop import. */
  public List<Map<String, String>> importArchive(String provider, String url) {
    Map<String, String> headers = new LinkedHashMap<>();
    headers.put("Accept", "application/json");
    String token = credentials.current().get("karakeepToken");
    if ("Karakeep".equals(provider) && token != null) headers.put("Authorization", "Bearer " + token);
    JsonNode body = parseJson(ok(http.get(url, headers)));
    JsonNode items = body.isArray() ? body : body.has("bookmarks") ? body.get("bookmarks") : body.has("items") ? body.get("items")
        : body.has("entries") ? body.get("entries") : body.has("results") ? body.get("results") : body.path("data");
    List<Map<String, String>> results = new ArrayList<>();
    for (JsonNode item : items) {
      if (results.size() >= 500) break;
      String link = first(item, "url", "link", "original_url");
      if (link.isEmpty()) continue;
      Map<String, String> row = new LinkedHashMap<>();
      String id = first(item, "id", "uuid");
      row.put("externalId", id.isEmpty() ? link : id);
      String title = first(item, "title", "name");
      row.put("title", title.isEmpty() ? link : title);
      row.put("url", link);
      row.put("summary", first(item, "description", "summary", "content"));
      row.put("createdAt", first(item, "created_at", "createdAt", "date"));
      results.add(row);
    }
    return results;
  }

  private static String first(JsonNode item, String... names) {
    for (String name : names) if (item.hasNonNull(name) && !item.get(name).asText().isEmpty()) return item.get(name).asText();
    return "";
  }

  /**
   * One web-watch check. Stateless: the client sends the watch record's last
   * hash and snapshot and stores the returned fields, exactly as the desktop
   * scheduler updates its own copy.
   */
  public Map<String, Object> checkWatch(Map<String, Object> watch) {
    Map<String, Object> next = new LinkedHashMap<>(watch);
    next.remove("error");
    String checkedAt = Instant.now().toString();
    next.put("lastChecked", checkedAt);
    try {
      String url = String.valueOf(watch.get("url"));
      SafeHttpFetcher.Response response = ok(http.get(url, Map.of("Accept", "text/html,text/plain")));
      Object selector = watch.get("selector");
      String snapshot = RemoteParsers.watchSnapshot(response.text(), selector instanceof String s ? s : null);
      String hash = sha256(snapshot);
      String lastHash = watch.get("lastHash") instanceof String s ? s : "";
      boolean changed = !lastHash.isEmpty() && !lastHash.equals(hash);
      next.put("lastHash", hash);
      next.put("lastSnapshot", snapshot);
      next.put("sourceUrl", response.finalUri().toString());
      next.put("status", changed ? "Changed" : "Active");
      if (changed) {
        String previous = watch.get("lastSnapshot") instanceof String s ? s : "";
        Map<String, Object> delta = RemoteParsers.watchDelta(previous, snapshot);
        next.put("previousHash", lastHash);
        next.put("previousSnapshot", previous);
        next.put("lastChanged", checkedAt);
        next.put("changeSummary", delta.get("summary"));
        next.put("materiality", delta.get("materiality"));
        next.put("addedLines", delta.get("addedLines"));
        next.put("removedLines", delta.get("removedLines"));
      }
    } catch (ResponseStatusException failure) {
      next.put("status", "Failed");
      next.put("error", failure.getReason());
    }
    return next;
  }

  public List<Map<String, String>> caldav(String url) {
    String user = credential("caldavUsername", "CREDENTIAL_MISSING_CALDAV");
    String password = credential("caldavPassword", "CREDENTIAL_MISSING_CALDAV");
    String authorization = "Basic " + java.util.Base64.getEncoder()
        .encodeToString((user + ":" + password).getBytes(StandardCharsets.UTF_8));
    String query = "<?xml version=\"1.0\" encoding=\"utf-8\"?><c:calendar-query xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\">"
        + "<d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name=\"VCALENDAR\">"
        + "<c:comp-filter name=\"VEVENT\"/></c:comp-filter></c:filter></c:calendar-query>";
    SafeHttpFetcher.Response response = ok(http.send("REPORT", url, Map.of("Authorization", authorization, "Depth", "1"),
        query.getBytes(StandardCharsets.UTF_8), "application/xml; charset=utf-8"));
    String body = response.text();
    // A plain .ics subscription answers REPORT with the calendar itself.
    return body.contains("BEGIN:VCALENDAR") && !body.contains("calendar-data")
        ? RemoteParsers.ics(body, url) : RemoteParsers.caldavReport(body, url);
  }

  public JsonNode ntfy(Map<String, Object> options) {
    String topic = String.valueOf(options.getOrDefault("topic", "")).strip();
    if (topic.isEmpty() || topic.length() > 64) throw problem(HttpStatus.BAD_REQUEST, "NTFY_TOPIC_REQUIRED");
    String endpoint = String.valueOf(options.getOrDefault("endpoint", "https://ntfy.sh")).replaceAll("/$", "");
    Map<String, Object> message = new LinkedHashMap<>();
    message.put("topic", topic);
    message.put("title", options.getOrDefault("title", "Modulo"));
    message.put("message", options.getOrDefault("message", "Test notification"));
    message.put("priority", options.getOrDefault("priority", "default"));
    if (options.get("tags") instanceof String tags && !tags.isBlank()) message.put("tags", List.of(tags.split("\\s*,\\s*")));
    if (options.get("clickUrl") instanceof String click && !click.isBlank()) message.put("click", http.validate(click).toString());
    Map<String, String> headers = new LinkedHashMap<>();
    String token = credentials.current().get("ntfyToken");
    if (token != null) headers.put("Authorization", "Bearer " + token);
    try {
      SafeHttpFetcher.Response response = ok(http.post(endpoint, headers, json.writeValueAsBytes(message), "application/json"));
      return parseJson(response);
    } catch (com.fasterxml.jackson.core.JsonProcessingException impossible) {
      throw new IllegalStateException(impossible);
    }
  }

  private static String q(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  public List<Map<String, String>> metadata(String provider, String query) {
    String term = query == null ? "" : query.strip();
    if (term.isEmpty() || term.length() > 200) throw problem(HttpStatus.BAD_REQUEST, "METADATA_QUERY_INVALID");
    List<Map<String, String>> results = new ArrayList<>();
    switch (provider) {
      case "Open Library" -> {
        JsonNode body = parseJson(ok(http.get("https://openlibrary.org/search.json?q=" + q(term)
            + "&limit=10&fields=key,title,author_name,first_publish_year,cover_i", Map.of())));
        for (JsonNode doc : body.path("docs")) {
          Map<String, String> item = result(provider, doc.path("key").asText(), doc.path("title").asText(), "Book");
          item.put("creator", doc.path("author_name").path(0).asText(""));
          if (doc.has("first_publish_year")) item.put("year", doc.path("first_publish_year").asText());
          if (doc.has("cover_i")) item.put("artworkUrl", "https://covers.openlibrary.org/b/id/" + doc.path("cover_i").asText() + "-M.jpg");
          item.put("sourceUrl", "https://openlibrary.org" + doc.path("key").asText());
          results.add(item);
        }
      }
      case "MusicBrainz" -> {
        JsonNode body = parseJson(ok(http.get("https://musicbrainz.org/ws/2/release-group/?query=" + q(term) + "&fmt=json&limit=10",
            Map.of("Accept", "application/json"))));
        for (JsonNode group : body.path("release-groups")) {
          String id = group.path("id").asText();
          Map<String, String> item = result(provider, id, group.path("title").asText(),
              "Single".equals(group.path("primary-type").asText()) ? "Song" : "Album");
          List<String> artists = new ArrayList<>();
          for (JsonNode credit : group.path("artist-credit")) artists.add(credit.path("name").asText());
          item.put("creator", String.join(", ", artists));
          String date = group.path("first-release-date").asText("");
          if (date.length() >= 4) item.put("year", date.substring(0, 4));
          item.put("artworkUrl", "https://coverartarchive.org/release-group/" + id + "/front-500");
          item.put("sourceUrl", "https://musicbrainz.org/release-group/" + id);
          results.add(item);
        }
      }
      case "TMDB" -> {
        String token = credential("tmdbToken", "CREDENTIAL_MISSING_TMDB");
        JsonNode body = parseJson(ok(http.get("https://api.themoviedb.org/3/search/multi?query=" + q(term) + "&include_adult=false",
            Map.of("Authorization", "Bearer " + token, "Accept", "application/json"))));
        for (JsonNode hit : body.path("results")) {
          String type = hit.path("media_type").asText();
          if (!type.equals("movie") && !type.equals("tv")) continue;
          Map<String, String> item = result(provider, hit.path("id").asText(),
              hit.has("title") ? hit.path("title").asText() : hit.path("name").asText(), type.equals("tv") ? "TV series" : "Movie");
          String date = hit.path(type.equals("tv") ? "first_air_date" : "release_date").asText("");
          if (date.length() >= 4) item.put("year", date.substring(0, 4));
          if (hit.hasNonNull("poster_path")) item.put("artworkUrl", "https://image.tmdb.org/t/p/w500" + hit.path("poster_path").asText());
          item.put("sourceUrl", "https://www.themoviedb.org/" + type + "/" + hit.path("id").asText());
          results.add(item);
        }
      }
      case "YouTube" -> {
        if (term.matches("(?i).*youtu(\\.be|be\\.com).*")) {
          JsonNode body = parseJson(ok(http.get("https://www.youtube.com/oembed?url=" + q(term) + "&format=json", Map.of())));
          Map<String, String> item = result(provider, term, body.path("title").asText(), "YouTube video");
          item.put("creator", body.path("author_name").asText(""));
          item.put("artworkUrl", body.path("thumbnail_url").asText(""));
          item.put("sourceUrl", term);
          results.add(item);
        } else {
          String key = credential("youtubeApiKey", "CREDENTIAL_MISSING_YOUTUBE");
          JsonNode body = parseJson(ok(http.get("https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q="
              + q(term) + "&key=" + q(key), Map.of())));
          for (JsonNode video : body.path("items")) {
            String id = video.path("id").path("videoId").asText();
            Map<String, String> item = result(provider, id, video.path("snippet").path("title").asText(), "YouTube video");
            item.put("creator", video.path("snippet").path("channelTitle").asText(""));
            item.put("artworkUrl", video.path("snippet").path("thumbnails").path("high").path("url").asText(""));
            item.put("sourceUrl", "https://www.youtube.com/watch?v=" + id);
            results.add(item);
          }
        }
      }
      case "IGDB" -> {
        String client = credential("igdbClientId", "CREDENTIAL_MISSING_IGDB");
        String secret = credential("igdbClientSecret", "CREDENTIAL_MISSING_IGDB");
        JsonNode auth = parseJson(ok(http.post("https://id.twitch.tv/oauth2/token?client_id=" + q(client) + "&client_secret=" + q(secret)
            + "&grant_type=client_credentials", Map.of(), new byte[0], "application/x-www-form-urlencoded")));
        String search = "search \"" + term.replaceAll("[\"\\\\]", "") + "\"; fields name,first_release_date,url,cover.url; limit 10;";
        JsonNode body = parseJson(ok(http.post("https://api.igdb.com/v4/games",
            Map.of("Client-ID", client, "Authorization", "Bearer " + auth.path("access_token").asText()),
            search.getBytes(StandardCharsets.UTF_8), "text/plain")));
        for (JsonNode game : body) {
          Map<String, String> item = result(provider, game.path("id").asText(), game.path("name").asText(), "Video game");
          if (game.has("first_release_date")) {
            item.put("year", String.valueOf(Instant.ofEpochSecond(game.path("first_release_date").asLong()).atZone(java.time.ZoneOffset.UTC).getYear()));
          }
          String cover = game.path("cover").path("url").asText("");
          if (!cover.isEmpty()) item.put("artworkUrl", "https:" + cover.replace("t_thumb", "t_cover_big"));
          item.put("sourceUrl", game.path("url").asText(""));
          results.add(item);
        }
      }
      default -> throw problem(HttpStatus.BAD_REQUEST, "METADATA_PROVIDER_UNSUPPORTED");
    }
    return results;
  }

  private static Map<String, String> result(String provider, String id, String title, String type) {
    Map<String, String> item = new LinkedHashMap<>();
    item.put("provider", provider);
    item.put("externalId", id);
    item.put("title", title);
    item.put("type", type);
    return item;
  }
}

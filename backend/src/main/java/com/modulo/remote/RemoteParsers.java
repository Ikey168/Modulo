package com.modulo.remote;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;

/** Pure parsers shared by the server-side service adapters; output shapes match the desktop services. */
final class RemoteParsers {
  static final int MAX_FEED_ITEMS = 250;
  static final int MAX_SNAPSHOT_CHARS = 200_000;

  private RemoteParsers() {}

  static String plain(String html) {
    return html == null ? "" : Jsoup.parse(html).text().replaceAll("\\s+", " ").strip();
  }

  private static String first(Element parent, String... names) {
    for (String name : names) {
      Element found = parent.selectFirst(name.replace(":", "|"));
      if (found != null && !found.text().isBlank()) return plain(found.text());
    }
    return "";
  }

  /** RSS 2.0 and Atom entries, newest-first as published by the feed. */
  static List<Map<String, String>> feed(String xml, String feedUrl) {
    Document document = Jsoup.parse(xml, feedUrl, Parser.xmlParser());
    boolean atom = document.selectFirst("feed") != null;
    Element channel = atom ? document.selectFirst("feed") : document.selectFirst("channel");
    String source = channel == null ? "" : first(channel, atom ? "feed > title" : "channel > title");
    List<Map<String, String>> items = new ArrayList<>();
    int index = 0;
    for (Element entry : document.select(atom ? "entry" : "item")) {
      if (items.size() >= MAX_FEED_ITEMS) break;
      String link;
      if (atom) {
        Element alternate = entry.selectFirst("link[rel=alternate], link:not([rel])");
        link = alternate == null ? "" : alternate.attr("href");
      } else {
        link = first(entry, "link");
      }
      Map<String, String> item = new LinkedHashMap<>();
      String id = first(entry, "guid", "id");
      item.put("externalId", !id.isEmpty() ? id : !link.isEmpty() ? link : feedUrl + "#" + index);
      String title = first(entry, "title");
      item.put("title", title.isEmpty() ? "Untitled feed item" : title);
      item.put("url", link);
      item.put("source", source);
      item.put("author", first(entry, "author > name", "author", "dc:creator"));
      item.put("publishedAt", first(entry, "pubDate", "published", "updated"));
      item.put("summary", first(entry, "description", "summary", "content"));
      item.put("feedUrl", feedUrl);
      items.add(item);
      index++;
    }
    return items;
  }

  private static String unfold(String ics) {
    return ics.replaceAll("\\r?\\n[ \\t]", "");
  }

  private static String icsValue(String block, String key) {
    Matcher match = Pattern.compile("^" + key + "(?:;[^:\\r\\n]*)?:(.*)$", Pattern.MULTILINE | Pattern.CASE_INSENSITIVE).matcher(block);
    if (!match.find()) return "";
    return match.group(1).replace("\\n", "\n").replace("\\N", "\n").replace("\\,", ",").replace("\\;", ";").strip();
  }

  static String icsDate(String value) {
    Matcher match = Pattern.compile("^(\\d{4})(\\d{2})(\\d{2})(?:T(\\d{2})(\\d{2})(\\d{2}))?").matcher(value == null ? "" : value);
    if (!match.find()) return "";
    String time = match.group(4) == null ? "00:00:00" : match.group(4) + ":" + match.group(5) + ":" + match.group(6);
    return match.group(1) + "-" + match.group(2) + "-" + match.group(3) + "T" + time + (value.endsWith("Z") ? "Z" : "");
  }

  static List<Map<String, String>> ics(String raw, String calendarUrl) {
    List<Map<String, String>> events = new ArrayList<>();
    Matcher blocks = Pattern.compile("BEGIN:VEVENT(.*?)END:VEVENT", Pattern.DOTALL).matcher(unfold(raw));
    while (blocks.find()) {
      String block = blocks.group(1);
      String uid = icsValue(block, "UID");
      if (uid.isEmpty()) continue;
      Map<String, String> event = new LinkedHashMap<>();
      event.put("remoteId", uid);
      String title = icsValue(block, "SUMMARY");
      event.put("title", title.isEmpty() ? "Untitled event" : title);
      event.put("startsAt", icsDate(icsValue(block, "DTSTART")));
      event.put("endsAt", icsDate(icsValue(block, "DTEND")));
      event.put("location", icsValue(block, "LOCATION"));
      event.put("description", icsValue(block, "DESCRIPTION"));
      event.put("calendarUrl", calendarUrl);
      events.add(event);
    }
    return events;
  }

  /** ICS payloads inside a CalDAV REPORT multistatus response. */
  static List<Map<String, String>> caldavReport(String xml, String calendarUrl) {
    Document document = Jsoup.parse(xml, calendarUrl, Parser.xmlParser());
    List<Map<String, String>> events = new ArrayList<>();
    for (Element data : document.getAllElements()) {
      if (data.tagName().toLowerCase().endsWith("calendar-data")) events.addAll(ics(data.wholeText(), calendarUrl));
    }
    return events;
  }

  /** Visible text of a page, optionally narrowed to lines containing a selector phrase (desktop parity). */
  static String watchSnapshot(String html, String selector) {
    Document document = Jsoup.parse(html);
    document.select("script, style, noscript, template").remove();
    StringBuilder lines = new StringBuilder();
    for (Element block : document.body() == null ? List.<Element>of() : document.body().select("h1,h2,h3,h4,h5,h6,p,li,td,th,dt,dd,pre,blockquote,figcaption")) {
      String text = block.ownText().strip();
      if (!text.isEmpty()) lines.append(text).append('\n');
    }
    String snapshot = lines.length() > 0 ? lines.toString() : document.text();
    if (selector != null && !selector.isBlank()) {
      String needle = selector.toLowerCase();
      StringBuilder filtered = new StringBuilder();
      for (String line : snapshot.split("\n")) if (line.toLowerCase().contains(needle)) filtered.append(line).append('\n');
      snapshot = filtered.toString();
    }
    return snapshot.length() > MAX_SNAPSHOT_CHARS ? snapshot.substring(0, MAX_SNAPSHOT_CHARS) : snapshot;
  }

  private static List<String> lines(String snapshot) {
    List<String> lines = new ArrayList<>();
    if (snapshot == null) return lines;
    for (String line : snapshot.split("\\r?\\n")) if (!line.isBlank()) lines.add(line.strip());
    return lines;
  }

  /** Same delta rules as the desktop web watch: set difference of lines, 10% threshold for "Material". */
  static Map<String, Object> watchDelta(String previous, String current) {
    List<String> before = lines(previous);
    List<String> after = lines(current);
    Map<String, Object> delta = new LinkedHashMap<>();
    if (before.isEmpty()) {
      delta.put("materiality", "Unknown");
      delta.put("summary", "Content changed; the previous snapshot is unavailable.");
      delta.put("addedLines", after.subList(0, Math.min(20, after.size())));
      delta.put("removedLines", List.of());
      return delta;
    }
    Set<String> beforeSet = new LinkedHashSet<>(before);
    Set<String> afterSet = new LinkedHashSet<>(after);
    List<String> added = afterSet.stream().filter(line -> !beforeSet.contains(line)).toList();
    List<String> removed = beforeSet.stream().filter(line -> !afterSet.contains(line)).toList();
    int changed = added.size() + removed.size();
    String materiality = changed >= Math.max(1, (int) Math.ceil(Math.max(beforeSet.size(), afterSet.size()) * 0.1)) ? "Material" : "Minor";
    delta.put("materiality", materiality);
    delta.put("summary", added.size() + " added, " + removed.size() + " removed line" + (changed == 1 ? "" : "s") + "; "
        + materiality.toLowerCase() + " change.");
    delta.put("addedLines", added.subList(0, Math.min(20, added.size())));
    delta.put("removedLines", removed.subList(0, Math.min(20, removed.size())));
    return delta;
  }
}

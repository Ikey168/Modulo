package com.modulo.remote;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RemoteParsersTest {
  @Test
  void parsesRssAndAtom() {
    String rss = "<rss><channel><title>Blog</title><item><title>First &amp; best</title><link>https://b.example/1</link>"
        + "<guid>g1</guid><description><![CDATA[<p>Hello <b>world</b></p>]]></description><pubDate>Mon, 01 Sep 2026</pubDate>"
        + "<dc:creator>Ada</dc:creator></item></channel></rss>";
    List<Map<String, String>> items = RemoteParsers.feed(rss, "https://b.example/feed");
    assertThat(items).hasSize(1);
    assertThat(items.get(0)).containsEntry("externalId", "g1").containsEntry("title", "First & best")
        .containsEntry("url", "https://b.example/1").containsEntry("source", "Blog").containsEntry("summary", "Hello world")
        .containsEntry("author", "Ada");

    String atom = "<feed xmlns=\"http://www.w3.org/2005/Atom\"><title>News</title><entry><id>tag:1</id><title>Update</title>"
        + "<link rel=\"alternate\" href=\"https://n.example/u\"/><author><name>Grace</name></author><updated>2026-09-01T00:00:00Z</updated>"
        + "<summary>Short</summary></entry></feed>";
    Map<String, String> entry = RemoteParsers.feed(atom, "https://n.example/atom").get(0);
    assertThat(entry).containsEntry("externalId", "tag:1").containsEntry("url", "https://n.example/u")
        .containsEntry("author", "Grace").containsEntry("source", "News").containsEntry("publishedAt", "2026-09-01T00:00:00Z");
  }

  @Test
  void parsesIcsAndCaldavReports() {
    String ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:e1\r\nSUMMARY:Stand-up\\, daily\r\nDTSTART:20260928T090000Z\r\n"
        + "DTEND:20260928T091500Z\r\nDESCRIPTION:Line one\\nline\r\n  two\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:no uid\r\nEND:VEVENT\r\nEND:VCALENDAR";
    List<Map<String, String>> events = RemoteParsers.ics(ics, "https://c.example/cal");
    assertThat(events).hasSize(1);
    assertThat(events.get(0)).containsEntry("title", "Stand-up, daily").containsEntry("startsAt", "2026-09-28T09:00:00Z")
        .containsEntry("description", "Line one\nline two");
    String report = "<d:multistatus xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\"><d:response><d:propstat><d:prop>"
        + "<c:calendar-data>" + ics.replace("&", "&amp;") + "</c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>";
    assertThat(RemoteParsers.caldavReport(report, "https://c.example/cal")).hasSize(1);
    assertThat(RemoteParsers.icsDate("20260928")).isEqualTo("2026-09-28T00:00:00");
  }

  @Test
  void watchSnapshotsIgnoreScriptsAndReportDeltas() {
    String before = RemoteParsers.watchSnapshot("<html><body><script>x()</script><p>Price 10</p><p>Stock yes</p></body></html>", null);
    String after = RemoteParsers.watchSnapshot("<html><body><p>Price 12</p><p>Stock yes</p></body></html>", null);
    assertThat(before).isEqualTo("Price 10\nStock yes\n");
    assertThat(RemoteParsers.watchSnapshot("<p>Price 12</p><p>Other</p>", "price")).isEqualTo("Price 12\n");
    Map<String, Object> delta = RemoteParsers.watchDelta(before, after);
    assertThat(delta).containsEntry("materiality", "Material").containsEntry("summary", "1 added, 1 removed lines; material change.")
        .containsEntry("addedLines", List.of("Price 12")).containsEntry("removedLines", List.of("Price 10"));
    assertThat(RemoteParsers.watchDelta("", after)).containsEntry("materiality", "Unknown");
  }
}

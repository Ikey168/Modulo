'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { decryptPayload, encryptPayload, nextOccurrence, normalizeRemoteItems, parseFeedXml, parseIcs } = require('./native-services');

test('encrypted sync snapshots round-trip and reject the wrong passphrase', () => {
  const encrypted = encryptPayload('{"version":1}', 'correct horse battery staple');
  assert.equal(decryptPayload(encrypted, 'correct horse battery staple'), '{"version":1}');
  assert.throws(() => decryptPayload(encrypted, 'incorrect passphrase'));
});

test('recurring reminders advance without drifting their local wall-clock fields', () => {
  assert.equal(nextOccurrence('2026-09-04T09:30:00.000Z', 'Daily'), '2026-09-05T09:30:00.000Z');
  assert.equal(nextOccurrence('2026-09-04T09:30:00.000Z', 'Weekly'), '2026-09-11T09:30:00.000Z');
  assert.equal(nextOccurrence('2026-09-04T09:30:00.000Z', 'Once'), null);
});

test('RSS and Atom entries normalize into a shared reading item shape', () => {
  const rss = parseFeedXml('<rss><channel><title>Modulo News</title><item><guid>42</guid><title>Native feeds</title><link>https://example.com/42</link><description><![CDATA[Useful <b>news</b>]]></description></item></channel></rss>', 'https://example.com/rss');
  const atom = parseFeedXml('<feed><title>Updates</title><entry><id>a-1</id><title>Atom entry</title><link href="https://example.com/a-1"/><summary>Summary</summary></entry></feed>', 'https://example.com/atom');
  assert.equal(rss[0].externalId, '42');
  assert.equal(rss[0].summary, 'Useful news');
  assert.equal(atom[0].url, 'https://example.com/a-1');
});

test('CalDAV calendar data and flexible archive APIs normalize safely', () => {
  const events = parseIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:event-1\r\nDTSTART:20260904T183000Z\r\nSUMMARY:Evening plan\r\nLOCATION:Home\r\nEND:VEVENT\r\nEND:VCALENDAR', 'http://radicale/calendar');
  assert.deepEqual(events[0], { remoteId: 'event-1', title: 'Evening plan', startsAt: '2026-09-04T18:30:00Z', endsAt: '', location: 'Home', description: '', calendarUrl: 'http://radicale/calendar' });
  assert.deepEqual(normalizeRemoteItems({ bookmarks: [{ id: 7, title: 'Saved', url: 'https://example.com' }] })[0], { externalId: '7', title: 'Saved', url: 'https://example.com', summary: '', createdAt: '' });
});

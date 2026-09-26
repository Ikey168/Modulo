'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { buildWatchDelta, decryptPayload, encryptPayload, fetchText, httpUrl, nextOccurrence, normalizeReminders, normalizeRemoteItems, normalizeWatches, parseFeedXml, parseIcs, syncPassphrase } = require('./native-services');

test('encrypted sync snapshots round-trip and reject the wrong passphrase', () => {
  const encrypted = encryptPayload('{"version":1}', 'correct horse battery staple');
  assert.equal(decryptPayload(encrypted, 'correct horse battery staple'), '{"version":1}');
  assert.throws(() => decryptPayload(encrypted, 'incorrect passphrase'));
  assert.equal(syncPassphrase('correct horse battery staple'), 'correct horse battery staple');
  assert.throws(() => syncPassphrase('short'), /between eight/);
  assert.throws(() => syncPassphrase('x'.repeat(4097)), /between eight/);
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

test('remote desktop imports validate URLs and bound redirects', async (t) => {
  assert.equal(httpUrl('https://example.com/path').hostname, 'example.com');
  assert.throws(() => httpUrl('file:///etc/passwd'), /HTTP or HTTPS/);
  assert.throws(() => httpUrl('https://user:password@example.com'), /embedded credentials/);

  const server = http.createServer((request, response) => {
    if (request.url === '/redirect') {
      response.writeHead(302, { Location: '/final' });
      response.end();
      return;
    }
    if (request.url === '/loop') {
      response.writeHead(302, { Location: '/loop' });
      response.end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('desktop import');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetchText(`${baseUrl}/redirect`)).text, 'desktop import');
  await assert.rejects(fetchText(`${baseUrl}/loop`), /Too many redirects/);
});

test('native schedules discard invalid records and clamp persisted intervals', () => {
  assert.deepEqual(normalizeWatches([
    { id: 'watch-1', title: 'A watch', url: 'https://example.com', frequencyMinutes: 1, status: 'Active' },
    { id: 'watch-2', title: 'Unsafe', url: 'file:///etc/passwd', frequencyMinutes: 60 },
  ]), [{ id: 'watch-1', title: 'A watch', url: 'https://example.com/', frequencyMinutes: 5, lastHash: '', previousHash: '', lastSnapshot: '', previousSnapshot: '', lastChecked: '', lastChanged: '', status: 'Active', error: '', changeSummary: '', materiality: 'Unknown', addedLines: [], removedLines: [], sourceUrl: '' }]);
  assert.deepEqual(normalizeReminders([
    { id: 'reminder-1', title: 'Valid', body: 'Body', dueAt: '2026-09-21T09:00:00.000Z', recurrence: 'Once' },
    { id: 'reminder-2', title: 'Invalid recurrence', dueAt: '2026-09-21T09:00:00.000Z', recurrence: 'Hourly' },
  ]), [{ id: 'reminder-1', title: 'Valid', body: 'Body', dueAt: '2026-09-21T09:00:00.000Z', recurrence: 'Once' }]);
});

test('web watch deltas retain bounded evidence and classify materiality', () => {
  const delta = buildWatchDelta('alpha\nbeta', 'alpha\ngamma');
  assert.equal(delta.addedCount, 1);
  assert.equal(delta.removedCount, 1);
  assert.equal(delta.materiality, 'Material');
  assert.deepEqual(delta.addedLines, ['gamma']);
  assert.deepEqual(delta.removedLines, ['beta']);
  assert.match(delta.summary, /1 added, 1 removed/);
  assert.equal(buildWatchDelta('', 'new content').materiality, 'Unknown');
});

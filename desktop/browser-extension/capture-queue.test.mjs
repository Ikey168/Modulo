import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPTURE_ACTIONS,
  buildCaptureDocuments,
  dueQueue,
  enqueue,
  markQueueFailure,
  queueLimits,
  removeFromQueue,
  safeCaptureUrl,
  safeEndpointUrl,
  sanitizeContext,
} from './capture-queue.mjs';

const tab = (overrides = {}) => ({
  id: 7,
  title: 'Example page',
  url: 'https://example.test/article?utm_source=mail',
  content: 'Visible page text.',
  selection: 'Selected claim.',
  ...overrides,
});

test('capture URLs and endpoint transport are bounded', () => {
  assert.equal(safeCaptureUrl('file:///etc/passwd'), '');
  assert.equal(safeCaptureUrl('https://user:password@example.test/'), '');
  assert.equal(safeCaptureUrl('https://example.test/'), 'https://example.test/');
  assert.equal(safeEndpointUrl('http://127.0.0.1:8100/api/v1/documents/ingest'), 'http://127.0.0.1:8100/api/v1/documents/ingest');
  assert.equal(safeEndpointUrl('http://example.test/ingest'), '');
  assert.equal(safeEndpointUrl('https://example.test/ingest/'), 'https://example.test/ingest');
});

test('every action produces an explicit Noesis request and safe Modulo context', () => {
  for (const action of CAPTURE_ACTIONS) {
    const [document] = buildCaptureDocuments({
      actionId: action.id,
      unit: 'selection',
      tabs: [tab()],
      context: { projectId: 'project-1', taskId: 'task:2', question: '  Verify this.  ', secret: 'discard' },
      capturedAt: '2026-09-21T00:00:00.000Z',
    });
    assert.equal(document.source_type, 'web');
    assert.equal(document.content, 'Selected claim.');
    assert.equal(document.metadata.capture_action, action.id);
    assert.equal(document.metadata.research_request, action.request);
    assert.equal(document.metadata.modulo_return_route, 'information-intake');
    assert.deepEqual(document.metadata.modulo_context, { projectId: 'project-1', taskId: 'task:2', question: 'Verify this.' });
    assert.match(document.document_id, /^browser:[0-9a-f]+$/);
  }
});

test('PDF and tab-group captures do not invent page content', () => {
  const [pdf] = buildCaptureDocuments({ actionId: 'save-source', unit: 'pdf', tabs: [tab({ url: 'https://example.test/report.pdf', content: 'should not be sent' })] });
  assert.equal(pdf.content, null);
  assert.equal(pdf.metadata.content_mode, 'url-only');

  const documents = buildCaptureDocuments({ actionId: 'research-page', unit: 'tabs', tabs: [tab({ id: 7, active: true }), tab({ id: 8, title: 'Second', url: 'https://example.test/second' })] });
  assert.equal(documents.length, 2);
  assert.equal(documents[1].content, null);
  assert.equal(documents[0].metadata.tab_group_size, 2);
});

test('queue deduplicates, preserves failed captures, and only returns due work', () => {
  const [document] = buildCaptureDocuments({ actionId: 'save-source', tabs: [tab()] });
  let queue = enqueue([], document, 100).queue;
  assert.equal(enqueue(queue, document, 100).added, false);
  queue = markQueueFailure(queue, document.document_id, 'offline', 100);
  assert.equal(queue[0].attempts, 1);
  assert.equal(dueQueue(queue, 100).length, 0);
  assert.equal(dueQueue(queue, queue[0].nextAttemptAt).length, 1);
  queue = removeFromQueue(queue, document.document_id);
  assert.deepEqual(queue, []);
  assert.equal(queueLimits.MAX_QUEUE_ITEMS, 50);
});

test('context validation drops secret-shaped and malformed identifiers', () => {
  assert.deepEqual(sanitizeContext({ projectId: 'p/1', areaId: 'area-1', noteId: 'note:1', question: 'question' }), {
    areaId: 'area-1', noteId: 'note:1', question: 'question',
  });
});

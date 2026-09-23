import { createHash, webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisFlashcardMigrationView } from '../NoesisFlashcardMigrationView';

const sourceValue = { card_id: 'legacy-card-9', question: 'What is a source revision?',
  answer: 'A versioned observation of the source.',
  review_logs: [{ rating: 4, reviewed_at_ms: 200 }],
  schedule_params: { algorithm: 'FSRS-6', desired_retention: 0.9, weights: [0.1, 0.2] } };
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(item => canonical(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value as object).sort()
    .map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};
const digest = createHash('sha256').update(canonical(sourceValue)).digest('hex');
const mock = vi.hoisted(() => ({ call: vi.fn(), set: vi.fn(), retry: vi.fn(), local: { namespace: 'research' } as Record<string, unknown>,
  source: {} as Record<string, unknown> }));
vi.mock('../noesisIntakeApi', () => ({ intakeCall: mock.call }));
vi.mock('../../PluginProvider', () => ({ usePlugins: () => ({
  isEnabled: () => true, state: async () => mock.source, stateSessionKey: 'account-one',
}) }));
vi.mock('../../usePluginState', () => ({ usePluginState: () => ({
  value: mock.local, ready: true, pending: false, error: undefined, conflict: undefined,
  set: mock.set, retry: mock.retry,
}) }));

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  mock.local = { namespace: 'research' };
  mock.call.mockReset(); mock.set.mockReset(); mock.retry.mockReset();
  mock.set.mockResolvedValue(undefined); mock.retry.mockResolvedValue(undefined);
  const row = { key: 'flashcard-9', schemaId: 'modulo.flashcard', schemaVersion: 3,
    value: sourceValue, deleted: false, pending: false };
  mock.source = {
    partition: JSON.stringify(['https://modulo.example', 'issuer', 'subject-1', 'workspace-1', 'home', 'replica']),
    status: 'idle', conflicts: () => [], refreshAll: vi.fn().mockResolvedValue(undefined),
    list: () => [row], recoverySnapshot: () => ({ entries: [{ key: 'flashcard-9', remote: {
      key: 'flashcard-9', schemaId: 'modulo.flashcard', schemaVersion: 3,
      version: 4, value: sourceValue, deleted: false, createdAt: 'now', updatedAt: 'now',
    } }] }),
  };
});

it('previews authenticated flashcard metadata and imports selected source history by exact revision', async () => {
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'preview_modulo_intake_migration') return { preview_id: 'modulo-migration:preview' };
    if (tool === 'inspect_modulo_intake_migration') return {
      preview_id: 'modulo-migration:preview',
      counts: { records: 1, link_in_place: 0, legacy_import_required: 0, review_required: 1 },
      records: [{ plugin_id: 'flashcards-spaced-repetition', collection: 'unclassified',
        record_id: 'flashcard-9', authoritative_version: 4, content_sha256: digest,
        action: 'review_mapping', requires_review: true }], next_offset: null,
    };
    if (tool === 'import_modulo_flashcards') return { pack_id: 'practice-pack:imported' };
    return {};
  });
  render(<NoesisFlashcardMigrationView namespace="research" available />);
  fireEvent.click(await screen.findByRole('button', { name: 'Preview plugin state' }));
  await screen.findByText(/modulo-migration:preview: 1 records/);
  expect(mock.set.mock.invocationCallOrder[0]).toBeLessThan(mock.retry.mock.invocationCallOrder[0]);
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('preview_modulo_intake_migration',
    expect.objectContaining({
      request_key: expect.stringMatching(/^modulo-flashcard-preview-/),
      inventory: expect.objectContaining({ source: 'caller_supplied_plugin_state',
        plugins: [expect.objectContaining({ plugin_id: 'flashcards-spaced-repetition', collections: [expect.objectContaining({
          collection: 'unclassified', schema_id: 'modulo.flashcard', schema_version: 3,
          records: [expect.objectContaining({ record_id: 'flashcard-9', authoritative_version: 4,
            content_sha256: digest })],
        })] })],
      }),
    })));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Mastery criterion'), {
    target: { value: 'Explain the idea without looking at the answer' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Import selected (1)' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('import_modulo_flashcards',
    expect.objectContaining({
      preview_id: 'modulo-migration:preview',
      source_values: [{ plugin_id: 'flashcards-spaced-repetition', collection: 'unclassified',
        record_id: 'flashcard-9', authoritative_version: 4, content_sha256: digest,
        value: sourceValue, mastery_criterion: 'Explain the idea without looking at the answer' }],
    })));
  expect(await screen.findByText(/practice-pack:imported imported/)).toBeInTheDocument();
});

it('keeps selected source revisions available while paging a migration preview', async () => {
  const values = Array.from({ length: 101 }, (_, index) => ({
    card_id: `source-card-${index + 1}`, question: `Flashcard ${index + 1}`,
    answer: `Answer ${index + 1}`, review_logs: [],
  }));
  const rows = values.map((value, index) => ({ key: `flashcard-${index + 1}`,
    schemaId: 'modulo.flashcard', schemaVersion: 3, value, deleted: false, pending: false }));
  const previews = values.map((value, index) => ({ plugin_id: 'flashcards-spaced-repetition',
    collection: 'unclassified', record_id: `flashcard-${index + 1}`,
    authoritative_version: 4, content_sha256: createHash('sha256').update(canonical(value)).digest('hex'),
    action: 'review_mapping', requires_review: true }));
  mock.source = {
    partition: JSON.stringify(['https://modulo.example', 'issuer', 'subject-1', 'workspace-1', 'home', 'replica']),
    status: 'idle', conflicts: () => [], refreshAll: vi.fn().mockResolvedValue(undefined),
    list: () => rows,
    recoverySnapshot: () => ({ entries: rows.map(row => ({ key: row.key, remote: {
      key: row.key, schemaId: row.schemaId, schemaVersion: row.schemaVersion,
      version: 4, value: row.value, deleted: false, createdAt: 'now', updatedAt: 'now',
    } })) }),
  };
  mock.call.mockImplementation(async (tool: string, input: { offset?: number }) => {
    if (tool === 'preview_modulo_intake_migration') return { preview_id: 'modulo-migration:pages' };
    if (tool === 'inspect_modulo_intake_migration') {
      const offset = input.offset ?? 0;
      return { preview_id: 'modulo-migration:pages',
        counts: { records: 101, link_in_place: 0, legacy_import_required: 0, review_required: 101 },
        records: previews.slice(offset, offset + 100), next_offset: offset === 0 ? 100 : null };
    }
    if (tool === 'import_modulo_flashcards') return { pack_id: 'practice-pack:pages' };
    return {};
  });
  render(<NoesisFlashcardMigrationView namespace="research" available />);
  fireEvent.click(await screen.findByRole('button', { name: 'Preview plugin state' }));
  await screen.findByText(/Preview modulo-migration:pages: 101 records/);
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  fireEvent.change(screen.getByLabelText('Mastery criterion'), {
    target: { value: 'Recall the first card without help' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText(/Flashcard 101/);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Mastery criterion'), {
    target: { value: 'Recall the last card without help' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Import selected (2)' }));
  await waitFor(() => {
    const call = mock.call.mock.calls.find(([tool]) => tool === 'import_modulo_flashcards');
    expect(call?.[1]).toEqual(expect.objectContaining({
      source_values: [
        expect.objectContaining({ record_id: 'flashcard-1', mastery_criterion: 'Recall the first card without help' }),
        expect.objectContaining({ record_id: 'flashcard-101', mastery_criterion: 'Recall the last card without help' }),
      ],
    }));
  });
});

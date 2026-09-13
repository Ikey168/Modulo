import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisPracticeView } from '../NoesisPracticeView';

const mock = vi.hoisted(() => ({ call: vi.fn(), set: vi.fn(), retry: vi.fn(),
  pointer: { namespace: 'research' } as Record<string, unknown> }));
vi.mock('../noesisIntakeApi', () => ({ intakeCall: mock.call }));
vi.mock('../../usePluginState', () => ({ usePluginState: () => ({
  value: mock.pointer, ready: true, pending: false, error: undefined, conflict: undefined,
  set: mock.set, retry: mock.retry,
}) }));

const refs = [{ kind: 'concept', id: 'concept:worker', namespace: 'research', version: 2 }];

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  mock.pointer = { namespace: 'research' };
  mock.call.mockReset(); mock.set.mockReset(); mock.retry.mockReset();
  mock.set.mockResolvedValue(undefined); mock.retry.mockResolvedValue(undefined);
});

it('saves an exact source-linked draft before Noesis creates a pack', async () => {
  mock.call.mockImplementation(async (tool: string) => tool === 'list_due_practice'
    ? { cards: [] } : { pack_id: 'practice-pack:one', revision: 1,
      title: 'Worker', cards: [] });
  render(<NoesisPracticeView namespace="research" available references={refs} />);
  fireEvent.change(screen.getByLabelText('Pack title'), { target: { value: 'Worker' } });
  fireEvent.change(screen.getByLabelText('Mastery criterion'), {
    target: { value: 'Recall without notes twice' },
  });
  fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'What stopped?' } });
  fireEvent.change(screen.getByLabelText('Author answer'), {
    target: { value: 'The indexing worker' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create draft pack' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('create_practice_pack',
    expect.objectContaining({ request_key: expect.stringMatching(/^modulo-practice-pack-/),
      cards: [{ kind: 'recall', prompt: 'What stopped?', answer: 'The indexing worker',
        mastery_criterion: 'Recall without notes twice', references: refs }] })));
  expect(mock.set).toHaveBeenCalledWith(expect.objectContaining({
    namespace: 'research', pendingCreate: expect.objectContaining({
      draft: expect.objectContaining({ reference: refs[0] }),
    }),
  }));
  expect(mock.set.mock.invocationCallOrder[0]).toBeLessThan(mock.retry.mock.invocationCallOrder[0]);
  expect(mock.retry.mock.invocationCallOrder[0]).toBeLessThan(mock.call.mock.invocationCallOrder[1]);
});

it('records an unaided answer before requesting reveal', async () => {
  mock.pointer = { namespace: 'research', packId: 'practice-pack:one',
    reviewId: 'practice-review:one' };
  mock.call.mockImplementation(async (tool: string, args: Record<string, unknown>) => {
    if (tool === 'list_due_practice') return { cards: [] };
    if (tool === 'inspect_practice_review') return { review_id: 'practice-review:one',
      pack_id: 'practice-pack:one', pack_revision: 1, card_id: 'card-1',
      revision: 1, status: 'active', prompt: 'What stopped?', kind: 'recall',
      attempt: null, assistance: null, assessment: null };
    if (tool === 'command_practice_review' && args.action === 'attempt') return {
      review_id: 'practice-review:one', pack_id: 'practice-pack:one',
      pack_revision: 1, card_id: 'card-1', revision: 2, status: 'attempted',
      prompt: 'What stopped?', kind: 'recall', attempt: 'The worker',
      assistance: 'reported_unaided', assessment: null,
    };
    if (tool === 'command_practice_review' && args.action === 'reveal') return {
      review_id: 'practice-review:one', pack_id: 'practice-pack:one',
      pack_revision: 1, card_id: 'card-1', revision: 3, status: 'revealed',
      prompt: 'What stopped?', kind: 'recall', attempt: 'The worker',
      assistance: 'reported_unaided', answer: 'The indexing worker',
      answer_status: 'author_supplied_unverified', assessment: null,
    };
    return {};
  });
  render(<NoesisPracticeView namespace="research" available references={refs} />);
  expect(await screen.findByLabelText('Your answer before reveal')).toBeInTheDocument();
  expect(mock.call).not.toHaveBeenCalledWith('inspect_practice_pack', expect.anything());
  expect(screen.queryByText(/Author answer \(author_supplied_unverified\)/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Your answer before reveal'), {
    target: { value: 'The worker' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record answer' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('command_practice_review',
    expect.objectContaining({ action: 'attempt', expected_revision: 1,
      payload: { answer: 'The worker', assisted: false } })));
  fireEvent.click(await screen.findByRole('button', { name: 'Reveal author answer' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('command_practice_review',
    expect.objectContaining({ action: 'reveal', expected_revision: 2, payload: {} })));
  expect(await screen.findByText(/Author answer \(author_supplied_unverified\): The indexing worker/))
    .toBeInTheDocument();
});

it('can abandon a rejected pack start without issuing another Noesis mutation', async () => {
  mock.pointer = { namespace: 'research', pendingCreate: {
    key: 'pack-key', draft: { title: 'Worker', kind: 'recall',
      prompt: 'What stopped?', answer: 'The worker',
      masteryCriterion: 'Recall without notes', reference: refs[0] },
  } };
  mock.call.mockResolvedValue({ cards: [] });
  render(<NoesisPracticeView namespace="research" available references={refs} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Abandon pending pack save' }));
  await waitFor(() => expect(mock.set).toHaveBeenCalledWith({ namespace: 'research' }));
  expect(mock.call).not.toHaveBeenCalledWith('create_practice_pack', expect.anything());
});

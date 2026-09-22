import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KnowledgePanel } from '../KnowledgePanel';
import { authenticatedRequest } from '../../../services/authenticatedRequest';
vi.mock('../../../services/authenticatedRequest', () => ({ authenticatedRequest: vi.fn() }));
const reply = (value: unknown) => Promise.resolve(new Response(JSON.stringify(value)));
beforeEach(() => { vi.mocked(authenticatedRequest).mockImplementation(async () => new Response(JSON.stringify({ provider_mode: 'LOCAL', monthly_budget_cents: 0 }))); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
async function open() {
  fireEvent.click(screen.getByText('Search knowledge and Ask Modulo'));
  await waitFor(() => expect(screen.getByLabelText('Knowledge provider')).not.toBeDisabled());
}
test('asks with a bounded context and opens inspectable source citations', async () => {
  const select = vi.fn();
  vi.mocked(authenticatedRequest).mockImplementation(path => path.endsWith('/ask') ? reply({ answer: 'Berlin is in Germany. [1]', answered: true, notice: 'Local extractive answer.', citations: [{ noteId: 12, title: 'Travel notes', excerpt: 'Berlin is in Germany.' }] }) : reply({ provider_mode: 'LOCAL' }));
  render(<KnowledgePanel noteId={1} onSelect={select} onLinksChanged={vi.fn()} />); await open();
  fireEvent.change(screen.getByLabelText('Knowledge question or search'), { target: { value: 'Berlin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask Modulo' }));
  expect(await screen.findByText('Berlin is in Germany. [1]')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Travel notes' })); expect(select).toHaveBeenCalledWith(12);
  const call = vi.mocked(authenticatedRequest).mock.calls.find(([path]) => path.endsWith('/ask'))!;
  expect(JSON.parse(call[1]!.body as string)).toEqual({ question: 'Berlin', maxCitations: 5 });
});
test('cancelled responses cannot replace the visible state', async () => {
  let resolve!: (response: Response) => void;
  vi.mocked(authenticatedRequest).mockImplementation(path => path.includes('/search?') ? new Promise(done => { resolve = done; }) : reply({ provider_mode: 'LOCAL' }));
  render(<KnowledgePanel onSelect={vi.fn()} onLinksChanged={vi.fn()} />); await open();
  fireEvent.change(screen.getByLabelText('Knowledge question or search'), { target: { value: 'Berlin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  resolve(new Response(JSON.stringify([{ noteId: 12, title: 'Late result', excerpt: '', score: 1, lexicalScore: 1, vectorScore: 0 }])));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('cancelled'));
  expect(screen.queryByText('Late result')).not.toBeInTheDocument();
});
test('suggestions require an explicit decision and refresh normal links on acceptance', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  vi.mocked(authenticatedRequest).mockImplementation(path => path.endsWith('/suggestions') ? reply([{ id: 'suggestion-1', targetNoteId: 12, explanation: 'Similar travel topic', status: 'PENDING' }]) : reply({ provider_mode: 'LOCAL' }));
  render(<KnowledgePanel noteId={1} onSelect={vi.fn()} onLinksChanged={refresh} />); await open();
  fireEvent.click(screen.getByRole('button', { name: 'Review suggested links' }));
  const accept = await screen.findByRole('button', { name: 'Accept link' });
  expect(refresh).not.toHaveBeenCalled(); accept.focus(); expect(accept).toHaveFocus(); fireEvent.click(accept);
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(screen.queryByText('Similar travel topic')).not.toBeInTheDocument();
});
test('AI disabled leaves lexical search available and remote mode cannot be selected', async () => {
  vi.mocked(authenticatedRequest).mockImplementation(() => reply({ provider_mode: 'OFF' }));
  render(<KnowledgePanel onSelect={vi.fn()} onLinksChanged={vi.fn()} />); await open();
  fireEvent.change(screen.getByLabelText('Knowledge question or search'), { target: { value: 'Berlin' } });
  expect(screen.getByRole('button', { name: 'Ask Modulo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Search' })).not.toBeDisabled();
  expect(screen.getByRole('option', { name: /Remote/ })).toBeDisabled();
});

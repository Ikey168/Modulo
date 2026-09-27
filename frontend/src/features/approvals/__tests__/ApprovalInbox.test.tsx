import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApprovalInbox } from '../ApprovalInbox';
import { signatureLabel } from '../signatureLabel';
import * as api from '../approvalService';
const { praxis } = vi.hoisted(() => ({ praxis: { pendingApprovals: vi.fn(), decide: vi.fn() } }));
vi.mock('../../praxis/praxisApi', async () => ({...await vi.importActual('../../praxis/praxisApi'), praxisApi: praxis}));
import { PraxisError, type PendingPraxisApproval } from '../../praxis/praxisApi';
vi.mock('../approvalService', async () => ({...await vi.importActual('../approvalService'), listApprovals:vi.fn(),getApproval:vi.fn(),decideApproval:vi.fn()}));
const request: api.Approval = {id:'request-1',revision:1,state:'PENDING',requester:'1',reviewer:'2',blueprintName:'Invoice review',expiresAt:'2099-01-01T12:00:00Z',createdAt:'2026-09-05T12:00:00Z',evidenceDigest:'abc',summary:{message:'Review invoice',omissions:['Note contents']},canDecide:true,decisions:[],events:[{state:'PENDING',created_at:'2026-09-05T12:00:00Z'}]};
const effect: PendingPraxisApproval = {source:'praxis',processId:'p-1',effectProcessId:'p-1',effectId:'e-1',version:3,attemptId:'a-2',kind:'file_write',target:'docs/x.md',reversible:true,title:'file write → docs/x.md',summary:'Update the docs',requestedAt:'2026-09-06T12:00:00Z',submittedAt:'2026-09-06T11:00:00Z'};
beforeEach(() => {vi.mocked(api.listApprovals).mockResolvedValue([request]);vi.mocked(api.getApproval).mockResolvedValue(request);praxis.pendingApprovals.mockReset().mockResolvedValue({configured:false,complete:true,approvals:[]});praxis.decide.mockReset();});
afterEach(() => {cleanup();vi.clearAllMocks();});
const detail = () => render(<MemoryRouter initialEntries={['/app/approvals?request=request-1']}><ApprovalInbox /></MemoryRouter>);
test('pending inbox exposes due dates and server history filters', async () => {
  render(<MemoryRouter><ApprovalInbox /></MemoryRouter>);expect(await screen.findByRole('link',{name:'Invoice review'})).toHaveAttribute('href','/?request=request-1');
  expect(screen.getByText(/Due:/)).toBeTruthy();fireEvent.change(screen.getByLabelText('Status'),{target:{value:'REJECTED'}});
  await waitFor(() => expect(api.listApprovals).toHaveBeenLastCalledWith('REJECTED',0,expect.any(AbortSignal)));
});
test('decision requires deliberate confirmation and rejection reason', async () => {
  detail();await screen.findByLabelText('Decision');const button=screen.getByRole('button',{name:'Record decision'});expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Decision'),{target:{value:'REJECT'}});fireEvent.click(screen.getByRole('checkbox'));expect(button).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Missing evidence'}});expect(screen.getByRole('checkbox')).not.toBeChecked();fireEvent.click(screen.getByRole('checkbox'));expect(button).not.toBeDisabled();
});
test('submits once, announces result, and removes decision controls', async () => {
  let complete!: (value:{state:string}) => void;vi.mocked(api.decideApproval).mockImplementation(() => new Promise(resolve => {complete=resolve;}));
  detail();await screen.findByLabelText('Decision');fireEvent.click(screen.getByRole('checkbox'));const button=screen.getByRole('button',{name:'Record decision'});fireEvent.click(button);fireEvent.click(button);expect(api.decideApproval).toHaveBeenCalledTimes(1);
  vi.mocked(api.getApproval).mockResolvedValue({...request,state:'APPROVED',canDecide:false});complete({state:'APPROVED'});
  expect(await screen.findByText(/Decision recorded: APPROVED/)).toBeTruthy();await waitFor(() => expect(screen.queryByRole('button',{name:'Record decision'})).toBeNull());
});
test('unavailable request renders no restricted details', async () => {
  vi.mocked(api.getApproval).mockRejectedValue(new api.ApprovalError(404,'This approval is unavailable.'));detail();expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');expect(screen.queryByText('Review invoice')).toBeNull();expect(screen.queryByRole('textbox')).toBeNull();
});
test('conflict refreshes state and clears confirmation', async () => {
  detail();await screen.findByLabelText('Decision');vi.mocked(api.decideApproval).mockRejectedValue(new api.ApprovalError(409,'Already resolved.'));vi.mocked(api.getApproval).mockResolvedValue({...request,state:'REJECTED',canDecide:false});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Record decision'}));expect(await screen.findByRole('alert')).toHaveTextContent('Already resolved');await waitFor(() => expect(screen.queryByRole('checkbox')).toBeNull());
});
test('detail has focusable heading, labeled form, safe evidence and no reviewer run link', async () => {
  detail();await screen.findByLabelText('Decision');expect(screen.getByRole('heading',{level:2})).toHaveFocus();expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby','comment-limit');expect(screen.getByRole('button',{name:'Open safe evidence summary'})).toBeTruthy();expect(screen.queryByRole('link',{name:'View workflow run'})).toBeNull();
});

test('signature labels separate identity claims from verification and anchoring', () => {
  expect(signatureLabel('SERVER_SIGNED')).toContain('Server signed');
  expect(signatureLabel('WALLET_SIGNED')).toContain('Wallet signed');
  expect(signatureLabel('UNSIGNED')).toContain('unverifiable');
  expect(signatureLabel('ANCHORED')).toContain('Unverifiable');
});

const inbox = () => render(<MemoryRouter><ApprovalInbox /></MemoryRouter>);
test('merges Praxis approvals with workflow approvals, each labeled with its source', async () => {
  praxis.pendingApprovals.mockResolvedValue({configured:true,complete:true,approvals:[effect]});
  inbox();
  await screen.findByText('Praxis task approval');
  const items = screen.getAllByRole('listitem');
  expect(items).toHaveLength(2);
  // Newest first: the Praxis effect was requested after the workflow approval.
  expect(items[0]).toHaveTextContent('Praxis task approval');expect(items[0]).toHaveTextContent('file write → docs/x.md');expect(items[0]).toHaveTextContent('Task: Update the docs');
  expect(items[1]).toHaveTextContent('Workflow approval');expect(items[1]).toHaveTextContent('Invoice review');
});
test('with Praxis not configured the inbox shows only workflow approvals', async () => {
  inbox();
  expect(await screen.findByRole('link',{name:'Invoice review'})).toBeTruthy();
  expect(screen.getAllByRole('listitem')).toHaveLength(1);expect(screen.queryByText('Praxis task approval')).toBeNull();expect(screen.queryByRole('status')).toBeNull();
});
test('Praxis approvals are only asked for with the pending filter', async () => {
  inbox();await screen.findByRole('link',{name:'Invoice review'});
  fireEvent.change(screen.getByLabelText('Status'),{target:{value:'APPROVED'}});
  await waitFor(() => expect(api.listApprovals).toHaveBeenLastCalledWith('APPROVED',0,expect.any(AbortSignal)));
  expect(praxis.pendingApprovals).toHaveBeenCalledTimes(1);
});
test('a Praxis outage leaves workflow approvals usable and says so', async () => {
  praxis.pendingApprovals.mockRejectedValue(new PraxisError('praxis_unavailable',503));
  inbox();
  expect(await screen.findByRole('link',{name:'Invoice review'})).toBeTruthy();
  expect(screen.getByRole('status')).toHaveTextContent('Praxis approvals could not be loaded');
});
test.each([[true,'Approve','Approved in Praxis.'],[false,'Reject','Rejected in Praxis.']])('deciding a Praxis approval (approved=%s) sends effect, version, attempt and reason, then reloads', async (approved,button,notice) => {
  praxis.pendingApprovals.mockResolvedValueOnce({configured:true,complete:true,approvals:[effect]});
  praxis.decide.mockResolvedValue({});
  inbox();
  const action = await screen.findByRole('button',{name:button});expect(action).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Reason \(required/),{target:{value:'  Checked the diff  '}});
  fireEvent.click(action);
  await waitFor(() => expect(praxis.decide).toHaveBeenCalledWith('p-1',{effect_id:'e-1',version:3,attempt_id:'a-2'},approved,'Checked the diff'));
  expect(await screen.findByText(notice)).toHaveAttribute('role','status');
  await waitFor(() => expect(praxis.pendingApprovals).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByText('Praxis task approval')).toBeNull());
});
test('a stale-attempt conflict (409) is shown clearly and the inbox reloads', async () => {
  const moved = {...effect,attemptId:'a-3'};
  praxis.pendingApprovals.mockResolvedValueOnce({configured:true,complete:true,approvals:[effect]}).mockResolvedValue({configured:true,complete:true,approvals:[moved]});
  praxis.decide.mockRejectedValueOnce(new PraxisError('stale_process_attempt',409));
  inbox();
  fireEvent.change(await screen.findByLabelText(/Reason \(required/),{target:{value:'Looks right'}});
  fireEvent.click(screen.getByRole('button',{name:'Approve'}));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('stale_process_attempt');expect(alert).toHaveTextContent('task moved on');expect(alert).toHaveTextContent('The task changed since you loaded it');
  await waitFor(() => expect(praxis.pendingApprovals).toHaveBeenCalledTimes(2));
  // The refreshed approval starts without a reason, so nothing is re-sent by accident.
  await waitFor(() => expect(screen.getByLabelText(/Reason \(required/)).toHaveValue(''));
  fireEvent.change(screen.getByLabelText(/Reason \(required/),{target:{value:'Looks right'}});
  praxis.decide.mockResolvedValue({});
  fireEvent.click(screen.getByRole('button',{name:'Approve'}));
  await waitFor(() => expect(praxis.decide).toHaveBeenLastCalledWith('p-1',{effect_id:'e-1',version:3,attempt_id:'a-3'},true,'Looks right'));
});

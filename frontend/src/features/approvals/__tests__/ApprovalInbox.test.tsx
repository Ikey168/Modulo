import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApprovalInbox } from '../ApprovalInbox';
import * as api from '../approvalService';
vi.mock('../approvalService', async () => ({...await vi.importActual('../approvalService'), listApprovals:vi.fn(),getApproval:vi.fn(),decideApproval:vi.fn()}));
const request: api.Approval = {id:'request-1',revision:1,state:'PENDING',requester:'1',reviewer:'2',blueprintName:'Invoice review',expiresAt:'2099-01-01T12:00:00Z',createdAt:'2026-09-05T12:00:00Z',evidenceDigest:'abc',summary:{message:'Review invoice',omissions:['Note contents']},canDecide:true,decisions:[],events:[{state:'PENDING',created_at:'2026-09-05T12:00:00Z'}]};
beforeEach(() => {vi.mocked(api.listApprovals).mockResolvedValue([request]);vi.mocked(api.getApproval).mockResolvedValue(request);});
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

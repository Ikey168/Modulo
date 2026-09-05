import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExecutionCenter } from '../ExecutionCenter';
import { editorRunLink, safeSummary } from '../runService';
afterEach(() => {cleanup();vi.unstubAllGlobals();});
const run = {id:'run-1',blueprint_id:1,blueprint_name:'Daily review',blueprint_version:'1',state:'FAILED',attempt:2,trigger_type:'trigger.schedule',created_at:'2026-09-05T10:00:00Z',started_at:null,finished_at:null,duration_ms:12,error_class:'NODE_FAILURE'};
test('filters server runs and displays empty results',async () => {
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async () => ({items:[],total:0,page:0,size:25})});vi.stubGlobal('fetch',fetcher);
  render(<MemoryRouter><ExecutionCenter /></MemoryRouter>);
  expect(await screen.findByText(/No runs match/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Status'),{target:{value:'FAILED'}});
  await waitFor(() => expect(fetcher.mock.calls[fetcher.mock.calls.length-1]?.[0]).toContain('state=FAILED'));
  fireEvent.change(screen.getByLabelText('Search'),{target:{value:'daily'}});
  await waitFor(() => expect(fetcher.mock.calls[fetcher.mock.calls.length-1]?.[0]).toContain('q=daily'));
});
test('detail displays safe summaries and keyboard-accessible editor links',async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async () => ({run,stepPage:0,stepTotal:1,nodeIds:['node-1'],steps:[{id:'step-1',sequence:1,attempt:2,node_id:'node-1',node_type:'action.code.execute',state:'FAILED',duration_ms:12,error_class:'NODE_FAILURE',input_metadata:JSON.stringify({fields:1,types:{text:1},secret:'NEVER_RENDER'}),output_metadata:'{}'}]})}));
  render(<MemoryRouter initialEntries={['/app/executions?run=run-1']}><ExecutionCenter /></MemoryRouter>);
  const link=await screen.findByRole('link',{name:'Select node in editor'});
  expect(link.getAttribute('href')).toContain('node=node-1');
  expect(link.getAttribute('href')).toContain('run=run-1');
  expect(screen.queryByText(/NEVER_RENDER/)).toBeNull();
  expect(screen.getAllByText(/Values redacted/)).toHaveLength(2);
});
test('retention gap gives an actionable unavailable state',async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({status:404,ok:false}));
  render(<MemoryRouter initialEntries={['/app/executions?run=gone']}><ExecutionCenter /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('retention policy');
  expect(screen.getByRole('button',{name:'Back to runs'})).toBeTruthy();
});
test('deep links encode names and summaries reject unknown fields',() => {
  expect(editorRunLink({...run,blueprint_name:'Review & approve'},'n&1')).toContain('node=n%261');
  expect(safeSummary('{"types":{"password":"secret"},"content":"private"}')).toBe('0 fields · Values redacted');
});
test('retry requires an explicit user acknowledgement and carries an idempotency key',async () => {
  const fetcher=vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST'
    ? {ok:true,json:async () => ({id:'retry-1'})}
    : {ok:true,json:async () => ({run,steps:[],nodeIds:[],stepPage:0,stepTotal:0,checkpoints:[0,2]})});
  vi.stubGlobal('fetch',fetcher);
  render(<MemoryRouter initialEntries={['/app/executions?run=run-1']}><ExecutionCenter /></MemoryRouter>);
  const consent=await screen.findByRole('checkbox',{name:/I understand that replayed actions/});
  expect(consent).not.toBeChecked();
  fireEvent.click(consent);
  fireEvent.click(screen.getByRole('button',{name:'Retry with a new attempt'}));
  await waitFor(() => expect(fetcher.mock.calls.some(call => call[1]?.method === 'POST')).toBe(true));
  const request=fetcher.mock.calls.find(call => call[1]?.method === 'POST');
  const body=JSON.parse(String(request?.[1]?.body));
  expect(body.confirmSideEffects).toBe(true);
  expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(body.checkpoint).toBe(0);
});

import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowAlerts, WorkflowPolicy } from '../WorkflowOperations';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('routes an alert to its workflow and acknowledges it',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[{id:'a1',blueprint_id:12,message:'Workflow 12 failed.',read_at:null}]}).mockResolvedValueOnce({ok:true});vi.stubGlobal('fetch',fetcher);
  render(<MemoryRouter><WorkflowAlerts/></MemoryRouter>);
  expect((await screen.findByRole('link',{name:'Workflow 12 failed.'})).getAttribute('href')).toContain('blueprint=12');
  fireEvent.click(screen.getByRole('button',{name:'Mark read'}));
  await waitFor(()=>expect(screen.queryByText('Workflow 12 failed.')).toBeNull());
  expect(fetcher).toHaveBeenLastCalledWith('/api/workflow-ops/alerts/a1/read',{method:'POST'});
});
test('saves retention and inbox routing without accepting a caller-supplied owner',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({retention_days:7,payload_hours:24,failure_threshold:2,window_minutes:15,route:'EXECUTION_CENTER'})});vi.stubGlobal('fetch',fetcher);
  const {container}=render(<WorkflowPolicy blueprint={12}/>);
  const details=container.querySelector('details')!;details.open=true;fireEvent(details,new Event('toggle'));
  const route=await screen.findByLabelText('Notification destination');fireEvent.change(route,{target:{value:'INBOX'}});
  fireEvent.submit(screen.getByRole('button',{name:'Save policy'}).closest('form')!);
  expect(await screen.findByText('Policy saved.')).toBeTruthy();
  const request=fetcher.mock.calls.find(call=>call[1]?.method==='PUT');
  expect(JSON.parse(request?.[1].body)).toEqual({retentionDays:7,payloadHours:24,failureThreshold:2,windowMinutes:15,route:'INBOX'});
});

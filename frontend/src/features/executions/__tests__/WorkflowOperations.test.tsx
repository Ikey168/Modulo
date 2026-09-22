import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowAlerts, WorkflowPolicy, WorkflowSchedules } from '../WorkflowOperations';
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
test('shows recurring schedules with the next run and delivery state',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>[{
    blueprint_id:12,blueprint_name:'Morning review',node_id:'daily',cron:'0 0 8 * * *',zone:'Europe/Berlin',next_fire:'2026-09-21T06:00:00Z',enabled:true,max_attempts:3,backoff_seconds:60,last_delivery_state:'DELIVERED',last_error_class:null,
  }]}));
  render(<MemoryRouter><WorkflowSchedules/></MemoryRouter>);
  expect(await screen.findByRole('link',{name:'Morning review'})).toHaveAttribute('href','/app/blueprints?blueprint=Morning%20review');
  expect(screen.getByText('0 0 8 * * *')).toBeTruthy();
  expect(screen.getByText('DELIVERED')).toBeTruthy();
  expect(screen.getByText(/Up to 3 attempts/)).toBeTruthy();
});

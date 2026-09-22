import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardView } from '../../workspace/DashboardView';
afterEach(() => {cleanup();vi.unstubAllGlobals();});
test('dashboard counts and workflow activity come from server runs',async () => {
  vi.stubGlobal('fetch',vi.fn(async (url: string) => ({ok:true,json:async () => url.endsWith('/summary') ? {counts:[{state:'SUCCEEDED',count:5},{state:'FAILED',count:2}]} : url.startsWith('/api/workflow-runs') ? {items:[{id:'r1',blueprint_name:'Daily review',state:'FAILED',created_at:new Date().toISOString()}]} : [{id:1,name:'Never executed',updatedAt:new Date().toISOString(),version:'1'}]})));
  render(<MemoryRouter><DashboardView notes={[]} installedPlugins={new Set()} onOpenNote={vi.fn()} onOpenBlueprints={vi.fn()} onOpenMarketplace={vi.fn()} /></MemoryRouter>);
  expect(await screen.findByText('failed · Daily review')).toBeTruthy();
  expect(screen.getByText('7')).toBeTruthy();
  expect(screen.queryByText('workflow updated · Never executed')).toBeNull();
});

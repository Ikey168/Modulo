import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {WorkspacePacks} from '../WorkspacePacks';
import * as api from '../workspacePackService';
import knowledge from '../../../../../shared/packs/knowledge-base.v2.json';
vi.mock('../workspacePackService',()=>({packRequest:vi.fn(),createPackPlan:vi.fn(),applyPackPlan:vi.fn(),uninstallPlan:vi.fn(),rollbackPlan:vi.fn()}));
const plan:api.PackPlan={id:'plan-1',pack_key:'org.modulo.knowledge-base',kind:'INSTALL',manifest_digest:'hash',status:'PLANNED',plan:{changes:[{resource:'schema',kind:'propertySchema',action:'ADD'}],requiredCapabilities:['properties:schema'],includeDemo:false}};
beforeEach(()=>{vi.mocked(api.packRequest).mockResolvedValue([]);vi.mocked(api.createPackPlan).mockResolvedValue(plan);});
afterEach(()=>{cleanup();vi.clearAllMocks();});
test('previews without consent and only applies the reviewed plan after confirmation',async()=>{
  vi.mocked(api.applyPackPlan).mockResolvedValue({...plan,status:'SUCCEEDED'});render(<WorkspacePacks/>);
  fireEvent.change(screen.getByLabelText('Pack manifest'),{target:{value:JSON.stringify(knowledge)}});fireEvent.click(screen.getByRole('button',{name:'Review install plan'}));
  const button=await screen.findByRole('button',{name:'Apply reviewed plan'});expect(button).toBeDisabled();expect(api.applyPackPlan).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('I approve these configuration changes and requested capabilities.'));fireEvent.click(button);
  await waitFor(()=>expect(api.applyPackPlan).toHaveBeenCalledWith(plan));expect(await screen.findByRole('status')).toHaveTextContent('completed');expect(screen.queryByRole('button',{name:'Apply reviewed plan'})).toBeNull();
});
test('changing demo selection invalidates the reviewed plan',async()=>{
  render(<WorkspacePacks/>);fireEvent.change(screen.getByLabelText('Pack manifest'),{target:{value:JSON.stringify(knowledge)}});fireEvent.click(screen.getByRole('button',{name:'Review install plan'}));await screen.findByRole('button',{name:'Apply reviewed plan'});
  fireEvent.click(screen.getByLabelText(/Create optional demo notes/));expect(screen.queryByRole('button',{name:'Apply reviewed plan'})).toBeNull();expect(api.applyPackPlan).not.toHaveBeenCalled();
});
test('install history exposes failed operations without inventing success',async()=>{
  vi.mocked(api.packRequest).mockImplementation(async path=>path.startsWith('/history')?[{id:'failed',pack_key:'example.pack',kind:'INSTALL',status:'FAILED',failure_code:'INSTALL_STAGE_FAILED',created_at:'2026-09-05T12:00:00Z'}]:[]);
  render(<WorkspacePacks/>);expect(await screen.findByText(/FAILED · INSTALL_STAGE_FAILED/)).toBeTruthy();expect(screen.queryByText(/operation completed/)).toBeNull();
});

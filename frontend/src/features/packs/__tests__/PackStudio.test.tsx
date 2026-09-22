import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {PackStudio} from '../PackStudio';
import {diagnosePack} from '../packAuthoring';
import {authenticatedRequest} from '../../../services/authenticatedRequest';
import audit from '../examples/security-audit.v2.json';
import type {PackManifest} from '../../blueprint/pack/packManifest';
vi.mock('../../../services/authenticatedRequest',()=>({authenticatedRequest:vi.fn()}));
const canonical=JSON.stringify(audit);
beforeEach(()=>{vi.mocked(authenticatedRequest).mockImplementation(async (path)=>new Response(JSON.stringify(String(path).endsWith('/preview')?{ok:true,canonicalSource:canonical,contentHash:'digest',capabilities:audit.capabilities}:String(path).endsWith('/publish')?{id:'publication',state:'PUBLISHED'}:[]),{status:200}));});
afterEach(()=>{cleanup();vi.clearAllMocks();});
test('authors an Audit draft and publishes only explicitly confirmed reviewed bytes without installing',async()=>{
  render(<MemoryRouter><PackStudio/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'New Audit draft'}));
  expect(screen.getByLabelText('Pack name')).toHaveValue('Security Audit');
  fireEvent.click(screen.getByRole('button',{name:'Preview package'}));
  const publish=await screen.findByRole('button',{name:'Publish reviewed source to IPFS'});
  expect(publish).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I confirm this manifest may be public/));fireEvent.click(publish);
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Publication verified'));
  const call=vi.mocked(authenticatedRequest).mock.calls.find(([path])=>String(path).endsWith('/publish'))!;
  expect(JSON.parse(call[1]!.body as string)).toEqual({source:canonical,expectedHash:'digest',publicConfirmation:true});
  expect(vi.mocked(authenticatedRequest).mock.calls.every(([path])=>!String(path).includes('/workspace-packs'))).toBe(true);
});
test('editing invalidates preview and its publication consent',async()=>{
  render(<MemoryRouter><PackStudio/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Preview package'}));await screen.findByRole('button',{name:'Publish reviewed source to IPFS'});
  fireEvent.change(screen.getByLabelText('Pack name'),{target:{value:'Changed'}});
  expect(screen.queryByRole('button',{name:'Publish reviewed source to IPFS'})).toBeNull();
});
test('identifies typed references and query properties at the affected contribution',()=>{
  const source=structuredClone(audit) as PackManifest;
  source.resources![2].spec.schemaRef='record-template';source.resources![2].requires=['record-template'];
  expect(diagnosePack(source)).toContainEqual({path:'resources[2] (open-records).spec.schemaRef',message:'Reference record-template must identify a propertySchema.'});
  const query=structuredClone(audit) as PackManifest;
  query.resources![2].spec.filters=[{property:'missing',operator:'eq',value:'x'}];
  expect(diagnosePack(query)).toContainEqual({path:'resources[2] (open-records).spec.filters[0].property',message:'Unknown property: missing.'});
});

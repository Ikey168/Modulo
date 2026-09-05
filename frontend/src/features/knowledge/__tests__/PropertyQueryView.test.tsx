import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {PropertyQueryResults} from '../PropertyQueryView';
import {authenticatedRequest} from '../../../services/authenticatedRequest';
vi.mock('../../../services/authenticatedRequest',()=>({authenticatedRequest:vi.fn()}));
const result={query:{id:'query',title:'Open work',revision:1,configuration:{filters:[],sort:{key:'noteId',direction:'asc'},groupBy:'status',columns:['status'],formulas:[],view:'table'}},rows:[{noteId:10,title:'Finding',version:1,values:{status:'Open'},formulas:{}}],page:0,hasMore:true};
beforeEach(()=>{vi.mocked(authenticatedRequest).mockImplementation(async path=>new Response(JSON.stringify(String(path).endsWith('/definitions')?[{key:'status',title:'Status',type:'select',options:['Open','Closed'],revision:1}]:String(path).includes('/api/notes/')?{id:10,version:1,content:'Body'}:result),{status:200}));});
afterEach(()=>{cleanup();vi.clearAllMocks();});
test('switches projections over the same notes and pages on the server',async()=>{
 render(<MemoryRouter><PropertyQueryResults id="query"/></MemoryRouter>);await screen.findByText('Finding');
 for(const view of ['list','card','board']){fireEvent.click(screen.getByRole('button',{name:view}));expect(screen.getByRole('link',{name:/Finding/})).toHaveAttribute('href','/app/notes?note=10');}
 expect(vi.mocked(authenticatedRequest).mock.calls.filter(([path])=>String(path).includes('/results'))).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'Next page'}));await waitFor(()=>expect(vi.mocked(authenticatedRequest).mock.calls.some(([path])=>String(path).includes('page=1'))).toBe(true));
});
test('direct edits save typed values and Markdown together then notify consumers',async()=>{
 const changed=vi.fn();window.addEventListener('modulo:properties-changed',changed);render(<MemoryRouter><PropertyQueryResults id="query"/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Edit Status for Finding'}));fireEvent.change(await screen.findByLabelText('Status'),{target:{value:'Closed'}});fireEvent.click(screen.getByRole('button',{name:'Apply property edit'}));await waitFor(()=>expect(changed).toHaveBeenCalled());
 const call=vi.mocked(authenticatedRequest).mock.calls.find(([path])=>String(path).endsWith('/document'))!;const body=JSON.parse(call[1]!.body as string);expect(body.change.set).toEqual({status:'Closed'});expect(body.markdown).toContain('status: Closed');expect(body.expectedMarkdown).toBe('Body');window.removeEventListener('modulo:properties-changed',changed);
});

import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {NotePropertyPanel} from '../NotePropertyPanel';
import {authenticatedRequest} from '../../../services/authenticatedRequest';
vi.mock('../../../services/authenticatedRequest',()=>({authenticatedRequest:vi.fn()}));
const definitions=[{key:'status',title:'Status',type:'select',options:['Open','Closed'],revision:1}];
beforeEach(()=>{vi.mocked(authenticatedRequest).mockImplementation(async path=>new Response(JSON.stringify(String(path).endsWith('/definitions')?definitions:[{noteId:10,version:2,values:{status:'Open'}}]),{status:200}));});
afterEach(()=>{cleanup();vi.clearAllMocks();});
test('labeled type editors submit one atomic document with the expected body and version',async()=>{
 const saved=vi.fn();render(<NotePropertyPanel noteId={10} content={"# Body\n"} notes={[]} onSaved={saved}/>);
 const choice=await screen.findByLabelText('Status');choice.focus();expect(choice).toHaveFocus();fireEvent.change(choice,{target:{value:'Closed'}});
 fireEvent.click(screen.getByRole('button',{name:'Save properties and Markdown'}));
 await waitFor(()=>expect(saved).toHaveBeenCalled());const call=vi.mocked(authenticatedRequest).mock.calls.find(([path])=>String(path).endsWith('/document'))!;const body=JSON.parse(call[1]!.body as string);expect(body.expectedMarkdown).toBe('# Body\n');expect(body.change).toEqual({noteId:10,version:2,set:{status:'Closed'},remove:[]});expect(body.markdown).toContain('status: Closed');expect(body.markdown.endsWith('# Body\n')).toBe(true);
});
test('concurrent save failure keeps property input and leaves the document untouched',async()=>{
 const original=vi.mocked(authenticatedRequest).getMockImplementation()!;vi.mocked(authenticatedRequest).mockImplementation((path,init)=>String(path).endsWith('/document')?Promise.resolve(new Response('{}',{status:409})):original(path,init));
 const saved=vi.fn();render(<NotePropertyPanel noteId={10} content="Body" notes={[]} onSaved={saved}/>);
 fireEvent.change(await screen.findByLabelText('Status'),{target:{value:'Closed'}});fireEvent.click(screen.getByRole('button',{name:'Save properties and Markdown'}));expect(await screen.findByRole('alert')).toHaveTextContent('input is retained');expect(screen.getByLabelText('Status')).toHaveValue('Closed');expect(saved).not.toHaveBeenCalled();
});

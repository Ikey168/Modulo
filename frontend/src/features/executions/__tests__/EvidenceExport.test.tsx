import {afterEach,expect,test,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {EvidenceExport} from '../EvidenceExport';
import {authenticatedRequest} from '../../../services/authenticatedRequest';
vi.mock('../../../services/authenticatedRequest',()=>({authenticatedRequest:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
test('additional omissions are explicit and preserved in the export request',async()=>{
  vi.mocked(authenticatedRequest).mockResolvedValue({ok:false} as Response);
  render(<EvidenceExport runId="run-1"/>);fireEvent.click(screen.getByText('Export evidence bundle'));
  fireEvent.click(screen.getByLabelText('Omit decision comments and signatures that contain them'));
  fireEvent.click(screen.getByRole('button',{name:'Download evidence ZIP'}));
  await waitFor(()=>expect(authenticatedRequest).toHaveBeenCalledWith(expect.stringContaining('omitComments=true')));
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');expect(screen.getByText(/not anchored/)).toBeTruthy();
});

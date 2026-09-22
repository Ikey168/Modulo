import { useState } from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyInformationIntake, type InformationIntakeData } from '../informationIntake';
import { ResearchProblemsView, ResearchExternalizationView } from '../ResearchWorkflowViews';
import type { WorkspaceViewProps } from '../plugins/types';

let state: InformationIntakeData;
vi.mock('../useInformationIntakeStore', () => ({
  useInformationIntakeStore: () => {
    const [, renderAgain] = useState(0);
    return [state, (update: (current: InformationIntakeData) => InformationIntakeData) => {
      state = update(state);
      renderAgain(value => value + 1);
    }];
  },
}));
afterEach(cleanup);
beforeEach(() => { state = emptyInformationIntake(); });

describe('independent research tools share existing records safely', () => {
  it('creates problems without exposing or overwriting decision cases', () => {
    state.cases = [{ id: 'decision-1', title: 'Existing decision', kind: 'Decision', status: 'Open', updatedAt: '2026-09-13' }];
    render(<ResearchProblemsView />);
    expect(screen.queryByText('Existing decision')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add record/ }));
    expect(state.cases).toHaveLength(2);
    expect(state.cases.find(record => record.id === 'decision-1')?.title).toBe('Existing decision');
    expect(state.cases.find(record => record.id !== 'decision-1')?.kind).toBe('Problem');
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Fix sync' } });
    expect(state.cases.find(record => record.kind === 'Problem')?.title).toBe('Fix sync');
    expect(state.cases.find(record => record.kind === 'Decision')?.title).toBe('Existing decision');
  });

  it('creates procedures and playbooks without changing creation briefs', () => {
    state.creations = [{ id: 'creation-1', title: 'Existing creation', kind: 'Creation', status: 'Open', updatedAt: '2026-09-13' }];
    const navigateView = vi.fn();
    render(<ResearchExternalizationView {...({ navigateView } as unknown as WorkspaceViewProps)} />);
    expect(screen.queryByText('Existing creation')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add record/ }));
    expect(state.creations).toHaveLength(2);
    expect(state.creations.find(record => record.id !== 'creation-1')?.kind).toBe('Externalization');
    fireEvent.click(screen.getByRole('button', { name: 'New output' }));
    expect(state.artifacts[0]).toMatchObject({ mode: 'Externalization', type: 'Playbook' });
    expect(state.creations.find(record => record.id === 'creation-1')?.title).toBe('Existing creation');
    expect(navigateView).toHaveBeenCalledWith('information-outputs');
  });
});

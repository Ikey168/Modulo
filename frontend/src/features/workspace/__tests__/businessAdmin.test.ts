import { describe, expect, it } from 'vitest';
import { businessAdminHealth, correspondenceOn, emptyBusinessAdmin, obligationsOn, parseBusinessAdmin } from '../businessAdmin';

describe('business administration store', () => {
  it('sanitizes collections and invalid choices', () => {
    const data = parseBusinessAdmin({
      clients: [{ id: 'client', name: 'Acme', type: 'invalid', status: 'invalid' }],
      engagements: [{ id: 'engagement', clientId: 'client', title: 'Audit', status: 'invalid', valueEur: -10 }],
      agreements: [], reconciliation: [], obligations: [], vendors: [], correspondence: [],
    });
    expect(data.clients[0]).toMatchObject({ type: 'Company', status: 'Lead' });
    expect(data.engagements[0]).toMatchObject({ status: 'Lead', valueEur: 0 });
  });

  it('projects obligations and correspondence into assigned day blocks', () => {
    const data = emptyBusinessAdmin();
    data.obligations.push({ id: 'filing', type: 'Tax filing', title: 'USt-VA', authority: 'Finanzamt', dueDate: '2026-09-10', blockId: 'ops-people', status: 'Open', reference: '', notes: '' });
    data.correspondence.push({ id: 'reply', direction: 'Inbound', counterpartyType: 'Authority', subject: 'Reply to Finanzamt', date: '2026-09-01', dueDate: '2026-09-10', blockId: 'ops-people', status: 'Open', notes: '' });
    expect(obligationsOn(data, '2026-09-10')).toHaveLength(1);
    expect(correspondenceOn(data, '2026-09-10')).toHaveLength(1);
  });

  it('derives actionable business health signals', () => {
    const data = emptyBusinessAdmin();
    data.engagements.push({ id: 'e', clientId: '', title: 'Retainer', status: 'Active', nextAction: '', notes: '' });
    data.obligations.push({ id: 'o', type: 'Report', title: 'Annual report', authority: '', dueDate: '2026-08-31', status: 'Open', reference: '', notes: '' });
    data.reconciliation.push({ id: 'r', sourceType: 'Bank', sourceRef: 'tx-1', date: '2026-09-01', counterparty: '', amountEur: 10, status: 'Unmatched', evidence: '', notes: '' });
    data.correspondence.push({ id: 'c', direction: 'Inbound', counterpartyType: 'Authority', subject: 'Question', date: '2026-08-01', dueDate: '2026-09-01', status: 'Waiting', notes: '' });
    const health = businessAdminHealth(data, '2026-09-04');
    expect(health.overdueObligations).toHaveLength(1);
    expect(health.unmatched).toHaveLength(1);
    expect(health.unanswered).toHaveLength(1);
    expect(health.missingNextActions).toHaveLength(1);
  });
});

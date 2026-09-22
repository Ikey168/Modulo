import { dayKey } from './noteDates';
import { useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  FileSignature,
  Landmark,
  Mail,
  Plus,
  Receipt,
  ScrollText,
  Truck,
  Users,
} from 'lucide-react';
import { Badge, Button, Input, Textarea } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import { DAY_BLOCKS } from './dayBlocks';
import {
  AGREEMENT_STATUSES,
  AGREEMENT_TYPES,
  CLIENT_STATUSES,
  CORRESPONDENCE_STATUSES,
  ENGAGEMENT_STATUSES,
  OBLIGATION_STATUSES,
  OBLIGATION_TYPES,
  RECONCILIATION_STATUSES,
  VENDOR_STATUSES,
  businessAdminHealth,
  newBusinessAdminId,
  type BusinessAgreement,
  type BusinessClient,
  type BusinessCorrespondence,
  type BusinessEngagement,
  type BusinessObligation,
  type BusinessVendor,
  type ReconciliationItem,
} from './businessAdmin';
import { useBusinessAdminStore } from './useBusinessAdminStore';
import { computeTotals, extractInvoices, formatEur } from './invoicing';
import { PopoverEditor } from './EntryPopover';
import { expenseGross, type ExpenseRecord } from './euer';
import { entryAmountEur } from './timeTracking';
import { useEuerStore, useTimeEntriesStore } from './usePluginDataStores';
import {
  CardGrid,
  Choice,
  ConfirmDelete,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  FilterChips,
  HealthLine,
  HealthList,
  ListRow,
  ListRows,
  Metric,
  MetricRow,
  Panel,
  RecordCard,
  RecordSheet,
  SearchInput,
  StatusBadge,
  Toolbar,
  ViewShell,
  type StatusVariant,
} from './viewkit';

const today = () => dayKey(new Date());

/**
 * Business vocabulary the shared status table does not cover. One map for the
 * whole file, so a "Prepared" filing reads the same everywhere.
 */
const BUSINESS_STATUS_TONES: Record<string, StatusVariant> = {
  lead: 'info',
  proposed: 'warning',
  dormant: 'outline',
  archived: 'outline',
  sent: 'info',
  accepted: 'success',
  signed: 'success',
  unmatched: 'warning',
  matched: 'success',
  reviewed: 'success',
  prepared: 'warning',
  submitted: 'info',
  'not applicable': 'outline',
  ending: 'warning',
  answered: 'success',
  filed: 'outline',
  complete: 'success',
};

const clientDraft = (): BusinessClient => ({
  id: newBusinessAdminId('client'),
  name: '',
  type: 'Company',
  status: 'Lead',
  email: '',
  phone: '',
  vatId: '',
  address: '',
  notes: '',
});
const engagementDraft = (): BusinessEngagement => ({
  id: newBusinessAdminId('engagement'),
  clientId: '',
  title: '',
  status: 'Lead',
  nextAction: '',
  notes: '',
});
const agreementDraft = (): BusinessAgreement => ({
  id: newBusinessAdminId('agreement'),
  type: 'Contract',
  title: '',
  status: 'Draft',
  date: today(),
  notes: '',
});
const reconciliationDraft = (): ReconciliationItem => ({
  id: newBusinessAdminId('reconciliation'),
  sourceType: 'Bank',
  sourceRef: '',
  date: today(),
  counterparty: '',
  amountEur: 0,
  status: 'Unmatched',
  evidence: '',
  notes: '',
});
const obligationDraft = (): BusinessObligation => ({
  id: newBusinessAdminId('obligation'),
  type: 'Tax filing',
  title: '',
  authority: '',
  dueDate: today(),
  status: 'Open',
  reference: '',
  notes: '',
});
const vendorDraft = (): BusinessVendor => ({
  id: newBusinessAdminId('vendor'),
  name: '',
  category: '',
  status: 'Active',
  email: '',
  noticePeriod: '',
  notes: '',
});
const correspondenceDraft = (): BusinessCorrespondence => ({
  id: newBusinessAdminId('correspondence'),
  direction: 'Inbound',
  counterpartyType: 'Authority',
  subject: '',
  date: today(),
  status: 'Open',
  notes: '',
});

const matches = (needle: string, ...values: (string | number | undefined)[]) =>
  !needle ||
  values
    .filter((value) => value !== undefined && value !== '')
    .join(' ')
    .toLowerCase()
    .includes(needle);

const blockOptions = DAY_BLOCKS.map((item) => ({ value: item.id, label: item.label }));
const blockLabel = (id: string | undefined) => DAY_BLOCKS.find((item) => item.id === id)?.label;

const chipOptions = (statuses: readonly string[], counted: { status: string }[], total: number) => [
  { value: 'all', label: 'All', count: total },
  ...statuses.map((value) => ({
    value,
    label: value,
    count: counted.filter((item) => item.status === value).length,
  })),
];

// ── Dashboard ────────────────────────────────────────────────────────────────

export function BusinessDashboardView({ data: workspace }: WorkspaceViewProps) {
  const [data] = useBusinessAdminStore();
  const [books] = useEuerStore();
  const [timeEntries] = useTimeEntriesStore();
  const date = today();
  const health = businessAdminHealth(data, date);
  const invoices = extractInvoices(workspace.notes);
  const unpaid = invoices.filter((item) => item.invoice.status !== 'paid');
  const unbilled = timeEntries
    .filter((entry) => entry.billable && !entry.billed)
    .reduce((total, entry) => total + entryAmountEur(entry), 0);
  const outstanding = unpaid.reduce((total, item) => total + computeTotals(item.invoice).gross, 0);
  const expenses = books.expenses.reduce((total, item) => total + expenseGross(item), 0);
  const openCorrespondence = data.correspondence.filter((item) =>
    ['Open', 'Waiting'].includes(item.status),
  ).length;

  return (
    <ViewShell
      title="Business overview"
      icon={BriefcaseBusiness}
      subtitle="Clients, commercial work, cash administration, filings, vendors, correspondence, and German accounting handoffs."
      bodyClassName="space-y-4 p-4"
    >
      <MetricRow className="xl:grid-cols-6">
        <Metric
          label="Active clients"
          value={data.clients.filter((item) => item.status === 'Active').length}
          detail={`${data.clients.length} in the directory`}
        />
        <Metric
          label="Active engagements"
          value={data.engagements.filter((item) => item.status === 'Active').length}
          detail={`${data.engagements.length} total`}
        />
        <Metric
          label="Unpaid invoices"
          value={unpaid.length}
          tone={unpaid.length ? 'warning' : 'default'}
          detail={formatEur(outstanding)}
        />
        <Metric
          label="Unmatched records"
          value={health.unmatched.length}
          tone={health.unmatched.length ? 'warning' : 'default'}
          detail="Awaiting reconciliation"
        />
        <Metric
          label="Overdue filings"
          value={health.overdueObligations.length}
          tone={health.overdueObligations.length ? 'danger' : 'default'}
          detail="Past their due date"
        />
        <Metric
          label="Open correspondence"
          value={openCorrespondence}
          detail="Open or waiting on a reply"
        />
      </MetricRow>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Panel title="Administrative health" icon={CalendarClock}>
          <HealthList>
            <HealthLine okay={!health.overdueObligations.length}>
              {health.overdueObligations.length
                ? `${health.overdueObligations.length} filing obligation${health.overdueObligations.length === 1 ? ' is' : 's are'} overdue.`
                : 'No tracked filing obligations are overdue.'}
            </HealthLine>
            <HealthLine okay={!health.unanswered.length}>
              {health.unanswered.length
                ? `${health.unanswered.length} correspondence item${health.unanswered.length === 1 ? ' needs' : 's need'} a response.`
                : 'No correspondence response deadline is overdue.'}
            </HealthLine>
            <HealthLine okay={!health.missingNextActions.length}>
              {health.missingNextActions.length
                ? `${health.missingNextActions.length} active engagement${health.missingNextActions.length === 1 ? ' needs' : 's need'} a next action.`
                : 'Active engagements have next actions.'}
            </HealthLine>
            <HealthLine okay={!health.expiringAgreements.length}>
              {health.expiringAgreements.length
                ? `${health.expiringAgreements.length} agreement${health.expiringAgreements.length === 1 ? ' expires' : 's expire'} within 30 days.`
                : 'No agreement expires within 30 days.'}
            </HealthLine>
          </HealthList>
        </Panel>

        <Panel
          title="Commercial snapshot"
          icon={Landmark}
          description="Administrative signals, not bank reconciliation or tax advice. Books remains the accounting source of truth."
          bodyClassName="p-0"
        >
          <ListRows>
            <ListRow
              title="Outstanding invoices"
              leading={<Landmark className="size-4 text-muted-foreground" aria-hidden="true" />}
              meta={<strong className="tabular-nums text-foreground">{formatEur(outstanding)}</strong>}
            />
            <ListRow
              title="Unbilled time"
              leading={<CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />}
              meta={<strong className="tabular-nums text-foreground">{formatEur(unbilled)}</strong>}
            />
            <ListRow
              title="Recorded expenses"
              leading={<Receipt className="size-4 text-muted-foreground" aria-hidden="true" />}
              meta={<strong className="tabular-nums text-foreground">{formatEur(expenses)}</strong>}
            />
          </ListRows>
        </Panel>
      </div>
    </ViewShell>
  );
}

// ── Directory: clients + engagements ─────────────────────────────────────────

/** Client fields shared by the create form and the edit sheet. */
function ClientFields({
  draft,
  setDraft,
}: {
  draft: BusinessClient;
  setDraft: (next: BusinessClient) => void;
}) {
  return (
    <>
      <Field label="Name">
        <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </Field>
      <FieldGroup legend="Classification" columns={2}>
        <Choice
          label="Type"
          value={draft.type}
          options={['Company', 'Individual']}
          onChange={(value) => setDraft({ ...draft, type: value as BusinessClient['type'] })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={CLIENT_STATUSES}
          onChange={(value) => setDraft({ ...draft, status: value as BusinessClient['status'] })}
        />
      </FieldGroup>
      <FieldGroup legend="Contact" columns={2}>
        <Field label="Email">
          <Input
            type="email"
            value={draft.email}
            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
          />
        </Field>
        <Field label="Phone">
          <Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input
            value={draft.address}
            onChange={(event) => setDraft({ ...draft, address: event.target.value })}
          />
        </Field>
        <Field label="VAT ID" className="sm:col-span-2" hint="Shown on invoices — check it carefully.">
          <Input value={draft.vatId} onChange={(event) => setDraft({ ...draft, vatId: event.target.value })} />
        </Field>
      </FieldGroup>
      <Field label="Notes">
        <Textarea
          rows={2}
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
      </Field>
    </>
  );
}

/** Engagement fields shared by the create form and the edit sheet. */
function EngagementFields({
  draft,
  setDraft,
  clients,
}: {
  draft: BusinessEngagement;
  setDraft: (next: BusinessEngagement) => void;
  clients: BusinessClient[];
}) {
  return (
    <>
      <Choice
        label="Client"
        value={draft.clientId}
        clearable
        clearLabel="Unassigned"
        placeholder="Select client"
        options={clients.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(clientId) => setDraft({ ...draft, clientId })}
      />
      <Field label="Title">
        <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </Field>
      <FieldGroup legend="Commercials" columns={2}>
        <Choice
          label="Status"
          value={draft.status}
          options={ENGAGEMENT_STATUSES}
          onChange={(value) => setDraft({ ...draft, status: value as BusinessEngagement['status'] })}
        />
        <Field label="Value €">
          <Input
            type="number"
            min={0}
            value={draft.valueEur ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, valueEur: Number(event.target.value) || undefined })
            }
          />
        </Field>
        <Field label="Start">
          <Input
            type="date"
            value={draft.startDate ?? ''}
            onChange={(event) => setDraft({ ...draft, startDate: event.target.value || undefined })}
          />
        </Field>
        <Field label="End">
          <Input
            type="date"
            value={draft.endDate ?? ''}
            onChange={(event) => setDraft({ ...draft, endDate: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
      <Field label="Next action" hint="An active engagement without one shows as a health warning.">
        <Input
          value={draft.nextAction}
          onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })}
        />
      </Field>
      <Field label="Notes">
        <Textarea
          rows={2}
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
      </Field>
    </>
  );
}

export function BusinessDirectoryView() {
  const [data, setData] = useBusinessAdminStore();
  const [clientForm, setClientForm] = useState(clientDraft);
  const [engagementForm, setEngagementForm] = useState(engagementDraft);
  const [query, setQuery] = useState('');
  const [clientStatus, setClientStatus] = useState('all');
  const [engagementStatus, setEngagementStatus] = useState('all');
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [openEngagementId, setOpenEngagementId] = useState<string | null>(null);

  const clientName = (id: string | undefined) =>
    data.clients.find((item) => item.id === id)?.name ?? 'Unassigned client';

  const addClient = () => {
    if (!clientForm.name.trim()) return;
    setData((current) => ({
      ...current,
      clients: [...current.clients, { ...clientForm, name: clientForm.name.trim() }],
    }));
    setClientForm(clientDraft());
  };
  const addEngagement = () => {
    if (!engagementForm.title.trim()) return;
    setData((current) => ({
      ...current,
      engagements: [...current.engagements, { ...engagementForm, title: engagementForm.title.trim() }],
    }));
    setEngagementForm(engagementDraft());
  };

  const needle = query.trim().toLowerCase();
  const clients = useMemo(
    () =>
      [...data.clients]
        .filter(
          (item) =>
            (clientStatus === 'all' || item.status === clientStatus) &&
            matches(needle, item.name, item.type, item.email, item.phone, item.vatId, item.address, item.notes),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.clients, clientStatus, needle],
  );
  const engagements = useMemo(
    () =>
      [...data.engagements]
        .filter(
          (item) =>
            (engagementStatus === 'all' || item.status === engagementStatus) &&
            matches(
              needle,
              item.title,
              item.nextAction,
              item.notes,
              data.clients.find((client) => client.id === item.clientId)?.name,
            ),
        )
        .sort((a, b) => a.title.localeCompare(b.title)),
    [data.engagements, data.clients, engagementStatus, needle],
  );

  const openClient = data.clients.find((item) => item.id === openClientId) ?? null;
  const openEngagement = data.engagements.find((item) => item.id === openEngagementId) ?? null;

  /** The store does not cascade — say exactly what a client delete leaves behind. */
  const clientConsequence = (id: string) => {
    const engaged = data.engagements.filter((item) => item.clientId === id).length;
    const agreed = data.agreements.filter((item) => item.clientId === id).length;
    if (!engaged && !agreed) return undefined;
    return `${engaged} engagement${engaged === 1 ? '' : 's'} and ${agreed} agreement${agreed === 1 ? '' : 's'} reference this client; they are kept but will show as unassigned.`;
  };
  const engagementConsequence = (id: string) => {
    const agreed = data.agreements.filter((item) => item.engagementId === id).length;
    return agreed
      ? `${agreed} agreement${agreed === 1 ? '' : 's'} reference this engagement; they are kept but will lose the link.`
      : undefined;
  };

  const removeClient = (id: string) =>
    setData((current) => ({ ...current, clients: current.clients.filter((item) => item.id !== id) }));
  const removeEngagement = (id: string) =>
    setData((current) => ({
      ...current,
      engagements: current.engagements.filter((item) => item.id !== id),
    }));

  return (
    <ViewShell
      title="Business Directory"
      icon={Building2}
      subtitle="Companies, contacts, engagements, pipeline state, value, and next actions."
      bodyClassName="space-y-4 p-4"
      toolbar={
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search clients and engagements…"
            label="Search clients and engagements"
          />
        </Toolbar>
      }
    >
      <Panel
        title="Clients"
        icon={Users}
        description={`${clients.length} of ${data.clients.length} shown`}
        actions={
          <PopoverEditor title="Add client">
            <ClientFields draft={clientForm} setDraft={setClientForm} />
            <Button onClick={addClient} disabled={!clientForm.name.trim()}>
              <Plus className="size-4" aria-hidden="true" />
              Add client
            </Button>
          </PopoverEditor>
        }
      >
        <FilterChips
          label="Filter clients by status"
          value={clientStatus}
          onChange={setClientStatus}
          options={chipOptions(CLIENT_STATUSES, data.clients, data.clients.length)}
          className="mb-3"
        />
        {clients.length === 0 ? (
          <EmptyPanel
            icon={Users}
            title={data.clients.length === 0 ? 'No clients yet' : 'No clients match'}
            description={
              data.clients.length === 0
                ? 'Add a company or individual to start tracking engagements against it.'
                : 'Try another search or status filter.'
            }
          />
        ) : (
          <CardGrid className="xl:grid-cols-2">
            {clients.map((item) => (
              <RecordCard
                key={item.id}
                title={item.name}
                onOpen={() => setOpenClientId(item.id)}
                badges={
                  <>
                    <Badge variant="secondary">{item.type}</Badge>
                    <StatusBadge status={item.status} overrides={BUSINESS_STATUS_TONES} />
                  </>
                }
                detail={
                  <>
                    <p>{[item.email, item.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
                    <p>{item.vatId ? `VAT ${item.vatId}` : 'No VAT ID'}</p>
                  </>
                }
                footer={`${data.engagements.filter((row) => row.clientId === item.id).length} engagements · ${data.agreements.filter((row) => row.clientId === item.id).length} documents`}
                actions={
                  <ConfirmDelete
                    itemName={item.name}
                    itemLabel="client"
                    onDelete={() => removeClient(item.id)}
                    consequence={clientConsequence(item.id)}
                  />
                }
              />
            ))}
          </CardGrid>
        )}
      </Panel>

      <Panel
        title="Engagements"
        icon={BriefcaseBusiness}
        description={`${engagements.length} of ${data.engagements.length} shown`}
        actions={
          <PopoverEditor title="Add engagement">
            <EngagementFields draft={engagementForm} setDraft={setEngagementForm} clients={data.clients} />
            <Button onClick={addEngagement} disabled={!engagementForm.title.trim()}>
              <Plus className="size-4" aria-hidden="true" />
              Add engagement
            </Button>
          </PopoverEditor>
        }
      >
        <FilterChips
          label="Filter engagements by status"
          value={engagementStatus}
          onChange={setEngagementStatus}
          options={chipOptions(ENGAGEMENT_STATUSES, data.engagements, data.engagements.length)}
          className="mb-3"
        />
        {engagements.length === 0 ? (
          <EmptyPanel
            icon={BriefcaseBusiness}
            title={data.engagements.length === 0 ? 'No engagements yet' : 'No engagements match'}
            description={
              data.engagements.length === 0
                ? 'Track proposed and active commercial work, its value, and the next action.'
                : 'Try another search or status filter.'
            }
          />
        ) : (
          <CardGrid className="xl:grid-cols-2">
            {engagements.map((item) => (
              <RecordCard
                key={item.id}
                title={item.title}
                onOpen={() => setOpenEngagementId(item.id)}
                badges={<StatusBadge status={item.status} overrides={BUSINESS_STATUS_TONES} />}
                detail={
                  <>
                    <p>
                      {clientName(item.clientId)}
                      {item.valueEur !== undefined ? ` · ${formatEur(item.valueEur)}` : ''}
                    </p>
                    <p>{item.nextAction ? `Next: ${item.nextAction}` : 'No next action recorded'}</p>
                  </>
                }
                actions={
                  <ConfirmDelete
                    itemName={item.title}
                    itemLabel="engagement"
                    onDelete={() => removeEngagement(item.id)}
                    consequence={engagementConsequence(item.id)}
                  />
                }
              />
            ))}
          </CardGrid>
        )}
      </Panel>

      <RecordSheet
        record={openClient}
        onClose={() => setOpenClientId(null)}
        title={openClient?.name ?? ''}
        subtitle={openClient?.type}
        badges={openClient && <StatusBadge status={openClient.status} overrides={BUSINESS_STATUS_TONES} />}
        renderEdit={(current, setCurrent) => <ClientFields draft={current} setDraft={setCurrent} />}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            clients: current.clients.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          openClient && (
            <ConfirmDelete
              itemName={openClient.name}
              itemLabel="client"
              onDelete={() => {
                removeClient(openClient.id);
                setOpenClientId(null);
              }}
              consequence={clientConsequence(openClient.id)}
            />
          )
        }
      >
        {openClient && (
          <FactGrid>
            <Fact label="Email" value={openClient.email} />
            <Fact label="Phone" value={openClient.phone} />
            <Fact label="VAT ID" value={openClient.vatId} emphasis placeholder="No VAT ID recorded" />
            <Fact label="Type" value={openClient.type} />
            <Fact label="Address" value={openClient.address} wide />
            <Fact label="Notes" value={openClient.notes} wide />
            <Fact
              label="Engagements"
              value={data.engagements.filter((item) => item.clientId === openClient.id).length}
            />
            <Fact
              label="Commercial documents"
              value={data.agreements.filter((item) => item.clientId === openClient.id).length}
            />
          </FactGrid>
        )}
      </RecordSheet>

      <RecordSheet
        record={openEngagement}
        onClose={() => setOpenEngagementId(null)}
        title={openEngagement?.title ?? ''}
        subtitle={openEngagement ? clientName(openEngagement.clientId) : undefined}
        badges={
          openEngagement && <StatusBadge status={openEngagement.status} overrides={BUSINESS_STATUS_TONES} />
        }
        renderEdit={(current, setCurrent) => (
          <EngagementFields draft={current} setDraft={setCurrent} clients={data.clients} />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            engagements: current.engagements.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          openEngagement && (
            <ConfirmDelete
              itemName={openEngagement.title}
              itemLabel="engagement"
              onDelete={() => {
                removeEngagement(openEngagement.id);
                setOpenEngagementId(null);
              }}
              consequence={engagementConsequence(openEngagement.id)}
            />
          )
        }
      >
        {openEngagement && (
          <FactGrid>
            <Fact label="Client" value={clientName(openEngagement.clientId)} />
            <Fact
              label="Value"
              value={openEngagement.valueEur !== undefined ? formatEur(openEngagement.valueEur) : ''}
            />
            <Fact label="Start" value={openEngagement.startDate} />
            <Fact label="End" value={openEngagement.endDate} placeholder="Open ended" />
            <Fact
              label="Next action"
              value={openEngagement.nextAction}
              wide
              emphasis
              placeholder="None — this engagement stalls"
            />
            <Fact label="Notes" value={openEngagement.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

// ── Proposals & contracts ────────────────────────────────────────────────────

/** Agreement fields shared by the create form and the edit sheet. */
function AgreementFields({
  draft,
  setDraft,
  clients,
  engagements,
  notes,
}: {
  draft: BusinessAgreement;
  setDraft: (next: BusinessAgreement) => void;
  clients: BusinessClient[];
  engagements: BusinessEngagement[];
  notes: { id: number; title: string }[];
}) {
  return (
    <>
      <Field label="Title">
        <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </Field>
      <FieldGroup legend="Document" columns={2}>
        <Choice
          label="Type"
          value={draft.type}
          options={AGREEMENT_TYPES}
          onChange={(value) => setDraft({ ...draft, type: value as BusinessAgreement['type'] })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={AGREEMENT_STATUSES}
          onChange={(value) => setDraft({ ...draft, status: value as BusinessAgreement['status'] })}
        />
        <Field label="Date">
          <Input
            type="date"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
        </Field>
        <Field label="Expires">
          <Input
            type="date"
            value={draft.expiresOn ?? ''}
            onChange={(event) => setDraft({ ...draft, expiresOn: event.target.value || undefined })}
          />
        </Field>
        <Field label="Value €">
          <Input
            type="number"
            min={0}
            value={draft.valueEur ?? ''}
            onChange={(event) => setDraft({ ...draft, valueEur: Number(event.target.value) || undefined })}
          />
        </Field>
      </FieldGroup>
      <FieldGroup legend="Links" columns={1}>
        <Choice
          label="Client"
          value={draft.clientId ?? ''}
          clearable
          clearLabel="No client"
          placeholder="Select client"
          options={clients.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(clientId) => setDraft({ ...draft, clientId: clientId || undefined })}
        />
        <Choice
          label="Engagement"
          value={draft.engagementId ?? ''}
          clearable
          clearLabel="No engagement"
          placeholder="Select engagement"
          options={engagements.map((item) => ({ value: item.id, label: item.title }))}
          onChange={(engagementId) => setDraft({ ...draft, engagementId: engagementId || undefined })}
        />
        <Choice
          label="Source note"
          value={draft.noteId !== undefined ? String(draft.noteId) : ''}
          clearable
          clearLabel="No note"
          placeholder="Select note"
          hint="Opens from the document card."
          options={notes.map((note) => ({ value: String(note.id), label: note.title || `Note ${note.id}` }))}
          onChange={(noteId) => setDraft({ ...draft, noteId: noteId ? Number(noteId) : undefined })}
        />
      </FieldGroup>
      <Field label="Notes">
        <Textarea
          rows={3}
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
      </Field>
    </>
  );
}

export function BusinessContractsView({ data: workspace, onOpenNote }: WorkspaceViewProps) {
  const [data, setData] = useBusinessAdminStore();
  const [form, setForm] = useState(agreementDraft);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const notes = workspace.notes.map((note) => ({ id: note.id, title: note.title }));
  const clientName = (id: string | undefined) => data.clients.find((item) => item.id === id)?.name;
  const engagementTitle = (id: string | undefined) =>
    data.engagements.find((item) => item.id === id)?.title;

  const add = () => {
    if (!form.title.trim()) return;
    setData((current) => ({
      ...current,
      agreements: [...current.agreements, { ...form, title: form.title.trim() }],
    }));
    setForm(agreementDraft());
  };

  const needle = query.trim().toLowerCase();
  const agreements = useMemo(
    () =>
      [...data.agreements]
        .filter(
          (item) =>
            (status === 'all' || item.status === status) &&
            matches(needle, item.title, item.type, item.notes, clientName(item.clientId), engagementTitle(item.engagementId)),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.agreements, data.clients, data.engagements, status, needle],
  );

  const open = data.agreements.find((item) => item.id === openId) ?? null;
  const removeAgreement = (id: string) =>
    setData((current) => ({ ...current, agreements: current.agreements.filter((item) => item.id !== id) }));

  return (
    <ViewShell
      title="Proposals & Contracts"
      icon={FileSignature}
      subtitle="Commercial documents, lifecycle state, value, expiry, and source-note references."
      actions={
        <PopoverEditor title="Add commercial document">
          <AgreementFields
            draft={form}
            setDraft={setForm}
            clients={data.clients}
            engagements={data.engagements}
            notes={notes}
          />
          <Button onClick={add} disabled={!form.title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add document
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search documents…"
            label="Search commercial documents"
          />
          <FilterChips
            label="Filter documents by status"
            value={status}
            onChange={setStatus}
            options={chipOptions(AGREEMENT_STATUSES, data.agreements, data.agreements.length)}
          />
        </Toolbar>
      }
    >
      {agreements.length === 0 ? (
        <EmptyPanel
          icon={ScrollText}
          size="page"
          title={data.agreements.length === 0 ? 'No proposals or contracts yet' : 'Nothing matches'}
          description={
            data.agreements.length === 0
              ? 'Record proposals, quotes, contracts and NDAs with their lifecycle state and expiry.'
              : 'Try another search or status filter.'
          }
        />
      ) : (
        <CardGrid>
          {agreements.map((item) => (
            <RecordCard
              key={item.id}
              title={item.title}
              onOpen={() => setOpenId(item.id)}
              badges={
                <>
                  <Badge variant="secondary">{item.type}</Badge>
                  <StatusBadge status={item.status} overrides={BUSINESS_STATUS_TONES} />
                </>
              }
              detail={
                <>
                  <p>
                    {clientName(item.clientId) ?? 'No client'}
                    {item.valueEur !== undefined ? ` · ${formatEur(item.valueEur)}` : ''}
                  </p>
                  <p>
                    Dated {item.date || 'unknown'}
                    {item.expiresOn ? ` · expires ${item.expiresOn}` : ''}
                  </p>
                </>
              }
              footer={
                item.noteId !== undefined ? (
                  <Button size="sm" variant="ghost" onClick={() => onOpenNote(item.noteId!)}>
                    <ScrollText className="size-4" aria-hidden="true" />
                    Open source note
                  </Button>
                ) : undefined
              }
              actions={
                <ConfirmDelete
                  itemName={item.title}
                  itemLabel="document"
                  onDelete={() => removeAgreement(item.id)}
                />
              }
            />
          ))}
        </CardGrid>
      )}

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.title ?? ''}
        subtitle={open?.type}
        badges={open && <StatusBadge status={open.status} overrides={BUSINESS_STATUS_TONES} />}
        renderEdit={(current, setCurrent) => (
          <AgreementFields
            draft={current}
            setDraft={setCurrent}
            clients={data.clients}
            engagements={data.engagements}
            notes={notes}
          />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            agreements: current.agreements.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={open.title}
              itemLabel="document"
              onDelete={() => {
                removeAgreement(open.id);
                setOpenId(null);
              }}
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Client" value={clientName(open.clientId)} placeholder="No client" />
            <Fact
              label="Engagement"
              value={engagementTitle(open.engagementId)}
              placeholder="No engagement"
            />
            <Fact label="Date" value={open.date} />
            <Fact label="Expires" value={open.expiresOn} emphasis placeholder="No expiry" />
            <Fact
              label="Value"
              value={open.valueEur !== undefined ? formatEur(open.valueEur) : ''}
            />
            <Fact
              label="Source note"
              value={
                open.noteId !== undefined ? (
                  <Button size="sm" variant="link" onClick={() => onOpenNote(open.noteId!)}>
                    {notes.find((note) => note.id === open.noteId)?.title || `Note ${open.noteId}`}
                  </Button>
                ) : (
                  ''
                )
              }
              placeholder="Not linked"
            />
            <Fact label="Notes" value={open.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

// ── Expense inbox & reconciliation ───────────────────────────────────────────

/** Reconciliation fields shared by the create form and the edit sheet. */
function ReconciliationFields({
  draft,
  setDraft,
}: {
  draft: ReconciliationItem;
  setDraft: (next: ReconciliationItem) => void;
}) {
  return (
    <>
      <FieldGroup legend="Record" columns={2}>
        <Choice
          label="Source"
          value={draft.sourceType}
          options={['Bank', 'Other', 'Expense', 'Invoice']}
          onChange={(value) => setDraft({ ...draft, sourceType: value as ReconciliationItem['sourceType'] })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={RECONCILIATION_STATUSES}
          onChange={(value) => setDraft({ ...draft, status: value as ReconciliationItem['status'] })}
        />
        <Field label="Reference" className="sm:col-span-2">
          <Input
            value={draft.sourceRef}
            onChange={(event) => setDraft({ ...draft, sourceRef: event.target.value })}
          />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
        </Field>
        <Field label="Amount €">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={draft.amountEur || ''}
            onChange={(event) => setDraft({ ...draft, amountEur: Number(event.target.value) || 0 })}
          />
        </Field>
      </FieldGroup>
      <Field label="Counterparty">
        <Input
          value={draft.counterparty}
          onChange={(event) => setDraft({ ...draft, counterparty: event.target.value })}
        />
      </Field>
      <Field label="Evidence / receipt">
        <Input
          value={draft.evidence}
          onChange={(event) => setDraft({ ...draft, evidence: event.target.value })}
        />
      </Field>
      <Field label="Notes">
        <Textarea
          rows={2}
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
      </Field>
    </>
  );
}

export function BusinessReconciliationView({ data: workspace }: WorkspaceViewProps) {
  const [data, setData] = useBusinessAdminStore();
  const [books] = useEuerStore();
  const [form, setForm] = useState(reconciliationDraft);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const captured = new Set(data.reconciliation.map((item) => `${item.sourceType}:${item.sourceRef}`));
  const expenses = books.expenses.filter((item) => !captured.has(`Expense:${item.id}`));
  const invoices = extractInvoices(workspace.notes).filter(
    (item) => !captured.has(`Invoice:${item.invoice.number}`),
  );

  const add = (item = form) => {
    if (!item.sourceRef.trim()) return;
    setData((current) => ({
      ...current,
      reconciliation: [{ ...item, sourceRef: item.sourceRef.trim() }, ...current.reconciliation],
    }));
    setForm(reconciliationDraft());
  };
  const captureExpense = (item: ExpenseRecord) =>
    add({
      id: newBusinessAdminId('reconciliation'),
      sourceType: 'Expense',
      sourceRef: item.id,
      date: item.date,
      counterparty: item.vendor,
      amountEur: expenseGross(item),
      status: 'Unmatched',
      evidence: '',
      notes: item.description,
    });
  const captureInvoice = (item: ReturnType<typeof extractInvoices>[number]) =>
    add({
      id: newBusinessAdminId('reconciliation'),
      sourceType: 'Invoice',
      sourceRef: item.invoice.number,
      date: item.invoice.date,
      counterparty: item.invoice.clientName,
      amountEur: computeTotals(item.invoice).gross,
      status: 'Unmatched',
      evidence: `Note ${item.noteId}`,
      notes: '',
    });

  const needle = query.trim().toLowerCase();
  const queue = useMemo(
    () =>
      [...data.reconciliation]
        .filter(
          (item) =>
            (status === 'all' || item.status === status) &&
            matches(needle, item.counterparty, item.sourceRef, item.sourceType, item.evidence, item.notes),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.reconciliation, status, needle],
  );

  const open = data.reconciliation.find((item) => item.id === openId) ?? null;
  const removeItem = (id: string) =>
    setData((current) => ({
      ...current,
      reconciliation: current.reconciliation.filter((item) => item.id !== id),
    }));

  return (
    <ViewShell
      title="Expense Inbox & Reconciliation"
      icon={Receipt}
      subtitle="Match administrative evidence to Books expenses, invoices, and bank records without replacing the accounting ledger."
      bodyClassName="space-y-4 p-4"
      actions={
        <PopoverEditor title="Add bank or other record">
          <ReconciliationFields draft={form} setDraft={setForm} />
          <Button onClick={() => add()} disabled={!form.sourceRef.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add record
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search the queue…"
            label="Search reconciliation queue"
          />
          <FilterChips
            label="Filter queue by status"
            value={status}
            onChange={setStatus}
            options={chipOptions(RECONCILIATION_STATUSES, data.reconciliation, data.reconciliation.length)}
          />
        </Toolbar>
      }
    >
      <Panel
        title="Reconciliation queue"
        icon={Landmark}
        description={`${queue.length} of ${data.reconciliation.length} shown`}
        bodyClassName="p-0"
      >
        {queue.length === 0 ? (
          <EmptyPanel
            icon={Landmark}
            title={data.reconciliation.length === 0 ? 'No records in the queue' : 'Nothing matches'}
            description={
              data.reconciliation.length === 0
                ? 'Queue a bank line, or capture an uncaptured Books expense or invoice below.'
                : 'Try another search or status filter.'
            }
          />
        ) : (
          <ListRows>
            {queue.map((item) => (
              <ListRow
                key={item.id}
                title={item.counterparty || item.sourceRef}
                onOpen={() => setOpenId(item.id)}
                detail={`${item.date} · ${formatEur(item.amountEur)} · ${item.sourceRef}`}
                leading={<Badge variant="secondary">{item.sourceType}</Badge>}
                meta={<StatusBadge status={item.status} overrides={BUSINESS_STATUS_TONES} />}
                actions={
                  <ConfirmDelete
                    itemName={item.counterparty || item.sourceRef}
                    itemLabel="record"
                    onDelete={() => removeItem(item.id)}
                    consequence="The source expense or invoice stays in Books; only this queue entry is removed."
                  />
                }
              />
            ))}
          </ListRows>
        )}
      </Panel>

      <Panel
        title="Uncaptured accounting sources"
        icon={Receipt}
        description="Books expenses and note invoices that are not represented in the queue yet."
        bodyClassName="p-0"
      >
        {expenses.length === 0 && invoices.length === 0 ? (
          <EmptyPanel
            icon={Receipt}
            title="Everything is represented"
            description="All visible Books expenses and invoices already have a queue entry."
          />
        ) : (
          <ListRows>
            {expenses.map((item) => (
              <ListRow
                key={item.id}
                title={`Expense · ${item.vendor}`}
                detail={`${item.date} · ${formatEur(expenseGross(item))}`}
                leading={<Receipt className="size-4 text-muted-foreground" aria-hidden="true" />}
                actions={
                  <Button size="sm" variant="outline" onClick={() => captureExpense(item)}>
                    <Plus className="size-4" aria-hidden="true" />
                    Queue
                  </Button>
                }
              />
            ))}
            {invoices.map((item) => (
              <ListRow
                key={`${item.noteId}-${item.invoice.number}`}
                title={`Invoice ${item.invoice.number} · ${item.invoice.clientName}`}
                detail={`${item.invoice.date} · ${formatEur(computeTotals(item.invoice).gross)}`}
                leading={<ScrollText className="size-4 text-muted-foreground" aria-hidden="true" />}
                actions={
                  <Button size="sm" variant="outline" onClick={() => captureInvoice(item)}>
                    <Plus className="size-4" aria-hidden="true" />
                    Queue
                  </Button>
                }
              />
            ))}
          </ListRows>
        )}
      </Panel>

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open ? open.counterparty || open.sourceRef : ''}
        subtitle={open ? `${open.sourceType} · ${open.sourceRef}` : undefined}
        badges={open && <StatusBadge status={open.status} overrides={BUSINESS_STATUS_TONES} />}
        renderEdit={(current, setCurrent) => (
          <ReconciliationFields draft={current} setDraft={setCurrent} />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            reconciliation: current.reconciliation.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={open.counterparty || open.sourceRef}
              itemLabel="record"
              onDelete={() => {
                removeItem(open.id);
                setOpenId(null);
              }}
              consequence="The source expense or invoice stays in Books; only this queue entry is removed."
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Date" value={open.date} />
            <Fact label="Amount" value={formatEur(open.amountEur)} emphasis />
            <Fact label="Counterparty" value={open.counterparty} />
            <Fact label="Reference" value={open.sourceRef} />
            <Fact label="Evidence / receipt" value={open.evidence} wide placeholder="No evidence linked" />
            <Fact label="Notes" value={open.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

// ── Filings & obligations ────────────────────────────────────────────────────

/** Obligation fields shared by the create form and the edit sheet. */
function ObligationFields({
  draft,
  setDraft,
}: {
  draft: BusinessObligation;
  setDraft: (next: BusinessObligation) => void;
}) {
  return (
    <>
      <Field label="Title">
        <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </Field>
      <FieldGroup legend="Obligation" columns={2}>
        <Choice
          label="Type"
          value={draft.type}
          options={OBLIGATION_TYPES}
          onChange={(value) => setDraft({ ...draft, type: value as BusinessObligation['type'] })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={OBLIGATION_STATUSES}
          onChange={(value) =>
            setDraft({
              ...draft,
              status: value as BusinessObligation['status'],
              submittedOn: value === 'Submitted' ? (draft.submittedOn ?? today()) : draft.submittedOn,
            })
          }
        />
        <Field label="Authority" className="sm:col-span-2">
          <Input
            value={draft.authority}
            onChange={(event) => setDraft({ ...draft, authority: event.target.value })}
          />
        </Field>
        <Field label="Due">
          <Input
            type="date"
            value={draft.dueDate}
            onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
          />
        </Field>
        <Choice
          label="Day block"
          value={draft.blockId ?? ''}
          clearable
          clearLabel="Unblocked"
          placeholder="Select day block"
          options={blockOptions}
          onChange={(blockId) =>
            setDraft({ ...draft, blockId: (blockId || undefined) as BusinessObligation['blockId'] })
          }
        />
        <Field label="Submitted on">
          <Input
            type="date"
            value={draft.submittedOn ?? ''}
            onChange={(event) => setDraft({ ...draft, submittedOn: event.target.value || undefined })}
          />
        </Field>
        <Field label="Reference">
          <Input
            value={draft.reference}
            onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
          />
        </Field>
      </FieldGroup>
      <Field label="Notes">
        <Textarea
          rows={3}
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
      </Field>
    </>
  );
}

export function BusinessObligationsView() {
  const [data, setData] = useBusinessAdminStore();
  const [form, setForm] = useState(obligationDraft);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const date = today();

  const add = () => {
    if (!form.title.trim() || !form.dueDate) return;
    setData((current) => ({
      ...current,
      obligations: [...current.obligations, { ...form, title: form.title.trim() }],
    }));
    setForm(obligationDraft());
  };

  const needle = query.trim().toLowerCase();
  const obligations = useMemo(
    () =>
      [...data.obligations]
        .filter(
          (item) =>
            (status === 'all' || item.status === status) &&
            matches(needle, item.title, item.authority, item.type, item.reference, item.notes),
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [data.obligations, status, needle],
  );

  const open = data.obligations.find((item) => item.id === openId) ?? null;
  const removeItem = (id: string) =>
    setData((current) => ({
      ...current,
      obligations: current.obligations.filter((item) => item.id !== id),
    }));

  return (
    <ViewShell
      title="Filings & Obligations"
      icon={Landmark}
      subtitle="Tax, insurance, registrations, renewals, reports, evidence, and day-block deadlines."
      actions={
        <PopoverEditor title="Add obligation">
          <ObligationFields draft={form} setDraft={setForm} />
          <Button onClick={add} disabled={!form.title.trim() || !form.dueDate}>
            <Plus className="size-4" aria-hidden="true" />
            Add obligation
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search obligations…"
            label="Search obligations"
          />
          <FilterChips
            label="Filter obligations by status"
            value={status}
            onChange={setStatus}
            options={chipOptions(OBLIGATION_STATUSES, data.obligations, data.obligations.length)}
          />
        </Toolbar>
      }
    >
      <Panel
        title="Due soonest first"
        icon={CalendarClock}
        description={`${obligations.length} of ${data.obligations.length} shown`}
        bodyClassName="p-0"
      >
        {obligations.length === 0 ? (
          <EmptyPanel
            icon={Landmark}
            title={data.obligations.length === 0 ? 'No obligations tracked' : 'Nothing matches'}
            description={
              data.obligations.length === 0
                ? 'Track filings, renewals and reports with the authority and the deadline that matters.'
                : 'Try another search or status filter.'
            }
          />
        ) : (
          <ListRows>
            {obligations.map((item) => {
              const overdue = ['Open', 'Prepared'].includes(item.status) && item.dueDate < date;
              return (
                <ListRow
                  key={item.id}
                  title={item.title}
                  onOpen={() => setOpenId(item.id)}
                  detail={
                    <>
                      Due {item.dueDate}
                      {overdue ? ' · overdue' : ''}
                      {item.authority ? ` · ${item.authority}` : ''}
                      {blockLabel(item.blockId) ? ` · ${blockLabel(item.blockId)}` : ''}
                    </>
                  }
                  leading={<Badge variant="secondary">{item.type}</Badge>}
                  meta={
                    <>
                      {overdue && <Badge variant="destructive">Overdue</Badge>}
                      <StatusBadge status={item.status} overrides={BUSINESS_STATUS_TONES} />
                    </>
                  }
                  actions={
                    <ConfirmDelete
                      itemName={item.title}
                      itemLabel="obligation"
                      onDelete={() => removeItem(item.id)}
                      consequence="Its day-block deadline disappears from the planner and calendar."
                    />
                  }
                />
              );
            })}
          </ListRows>
        )}
      </Panel>

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.title ?? ''}
        subtitle={open ? `${open.type} · due ${open.dueDate}` : undefined}
        badges={open && <StatusBadge status={open.status} overrides={BUSINESS_STATUS_TONES} />}
        renderEdit={(current, setCurrent) => <ObligationFields draft={current} setDraft={setCurrent} />}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            obligations: current.obligations.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          open && (
            <ConfirmDelete
              itemName={open.title}
              itemLabel="obligation"
              onDelete={() => {
                removeItem(open.id);
                setOpenId(null);
              }}
              consequence="Its day-block deadline disappears from the planner and calendar."
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Authority" value={open.authority} />
            <Fact label="Due" value={open.dueDate} emphasis />
            <Fact label="Submitted on" value={open.submittedOn} placeholder="Not submitted" />
            <Fact label="Day block" value={blockLabel(open.blockId)} placeholder="Unblocked" />
            <Fact label="Reference" value={open.reference} wide />
            <Fact label="Notes" value={open.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

// ── Vendors & correspondence ─────────────────────────────────────────────────

/** Vendor fields shared by the create form and the edit sheet. */
function VendorFields({
  draft,
  setDraft,
}: {
  draft: BusinessVendor;
  setDraft: (next: BusinessVendor) => void;
}) {
  return (
    <>
      <Field label="Name">
        <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </Field>
      <FieldGroup legend="Relationship" columns={2}>
        <Field label="Category">
          <Input
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
        </Field>
        <Choice
          label="Status"
          value={draft.status}
          options={VENDOR_STATUSES}
          onChange={(value) => setDraft({ ...draft, status: value as BusinessVendor['status'] })}
        />
        <Field label="Email" className="sm:col-span-2">
          <Input
            type="email"
            value={draft.email}
            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
          />
        </Field>
      </FieldGroup>
      <FieldGroup legend="Term" columns={2}>
        <Field label="Renewal">
          <Input
            type="date"
            value={draft.renewalDate ?? ''}
            onChange={(event) => setDraft({ ...draft, renewalDate: event.target.value || undefined })}
          />
        </Field>
        <Field label="Contract end">
          <Input
            type="date"
            value={draft.contractEnd ?? ''}
            onChange={(event) => setDraft({ ...draft, contractEnd: event.target.value || undefined })}
          />
        </Field>
        <Field label="Notice period" className="sm:col-span-2">
          <Input
            value={draft.noticePeriod}
            onChange={(event) => setDraft({ ...draft, noticePeriod: event.target.value })}
          />
        </Field>
      </FieldGroup>
      <Field label="Notes">
        <Textarea
          rows={2}
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
      </Field>
    </>
  );
}

/** Correspondence fields shared by the create form and the edit sheet. */
function CorrespondenceFields({
  draft,
  setDraft,
  clients,
  vendors,
}: {
  draft: BusinessCorrespondence;
  setDraft: (next: BusinessCorrespondence) => void;
  clients: BusinessClient[];
  vendors: BusinessVendor[];
}) {
  const counterparties =
    draft.counterpartyType === 'Client'
      ? clients.map((item) => ({ value: item.id, label: item.name }))
      : draft.counterpartyType === 'Vendor'
        ? vendors.map((item) => ({ value: item.id, label: item.name }))
        : [];
  return (
    <>
      <Field label="Subject">
        <Input
          value={draft.subject}
          onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
        />
      </Field>
      <FieldGroup legend="Counterparty" columns={2}>
        <Choice
          label="Direction"
          value={draft.direction}
          options={['Inbound', 'Outbound']}
          onChange={(value) => setDraft({ ...draft, direction: value as BusinessCorrespondence['direction'] })}
        />
        <Choice
          label="Party type"
          value={draft.counterpartyType}
          options={['Client', 'Vendor', 'Authority', 'Other']}
          onChange={(value) =>
            setDraft({
              ...draft,
              counterpartyType: value as BusinessCorrespondence['counterpartyType'],
              counterpartyId: undefined,
            })
          }
        />
        {counterparties.length > 0 && (
          <Choice
            label={draft.counterpartyType}
            value={draft.counterpartyId ?? ''}
            clearable
            clearLabel="Not linked"
            placeholder={`Select ${draft.counterpartyType.toLowerCase()}`}
            options={counterparties}
            onChange={(counterpartyId) => setDraft({ ...draft, counterpartyId: counterpartyId || undefined })}
            className="sm:col-span-2"
          />
        )}
      </FieldGroup>
      <FieldGroup legend="Handling" columns={2}>
        <Field label="Date">
          <Input
            type="date"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
        </Field>
        <Field label="Response due">
          <Input
            type="date"
            value={draft.dueDate ?? ''}
            onChange={(event) => setDraft({ ...draft, dueDate: event.target.value || undefined })}
          />
        </Field>
        <Choice
          label="Status"
          value={draft.status}
          options={CORRESPONDENCE_STATUSES}
          onChange={(value) => setDraft({ ...draft, status: value as BusinessCorrespondence['status'] })}
        />
        <Choice
          label="Day block"
          value={draft.blockId ?? ''}
          clearable
          clearLabel="Unblocked"
          placeholder="Select day block"
          options={blockOptions}
          onChange={(blockId) =>
            setDraft({ ...draft, blockId: (blockId || undefined) as BusinessCorrespondence['blockId'] })
          }
        />
      </FieldGroup>
      <Field label="Notes">
        <Textarea
          rows={2}
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
      </Field>
    </>
  );
}

export function BusinessOperationsView() {
  const [data, setData] = useBusinessAdminStore();
  const [vendorForm, setVendorForm] = useState(vendorDraft);
  const [letterForm, setLetterForm] = useState(correspondenceDraft);
  const [query, setQuery] = useState('');
  const [vendorStatus, setVendorStatus] = useState('all');
  const [letterStatus, setLetterStatus] = useState('all');
  const [openVendorId, setOpenVendorId] = useState<string | null>(null);
  const [openLetterId, setOpenLetterId] = useState<string | null>(null);

  const addVendor = () => {
    if (!vendorForm.name.trim()) return;
    setData((current) => ({
      ...current,
      vendors: [...current.vendors, { ...vendorForm, name: vendorForm.name.trim() }],
    }));
    setVendorForm(vendorDraft());
  };
  const addLetter = () => {
    if (!letterForm.subject.trim()) return;
    setData((current) => ({
      ...current,
      correspondence: [...current.correspondence, { ...letterForm, subject: letterForm.subject.trim() }],
    }));
    setLetterForm(correspondenceDraft());
  };

  const counterpartyName = (item: BusinessCorrespondence) => {
    if (!item.counterpartyId) return item.counterpartyType;
    const match =
      data.clients.find((client) => client.id === item.counterpartyId) ??
      data.vendors.find((vendor) => vendor.id === item.counterpartyId);
    return match ? `${item.counterpartyType} · ${match.name}` : item.counterpartyType;
  };

  const needle = query.trim().toLowerCase();
  const vendors = useMemo(
    () =>
      [...data.vendors]
        .filter(
          (item) =>
            (vendorStatus === 'all' || item.status === vendorStatus) &&
            matches(needle, item.name, item.category, item.email, item.noticePeriod, item.notes),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.vendors, vendorStatus, needle],
  );
  const letters = useMemo(
    () =>
      [...data.correspondence]
        .filter(
          (item) =>
            (letterStatus === 'all' || item.status === letterStatus) &&
            matches(needle, item.subject, item.direction, item.counterpartyType, item.notes),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.correspondence, letterStatus, needle],
  );

  const openVendor = data.vendors.find((item) => item.id === openVendorId) ?? null;
  const openLetter = data.correspondence.find((item) => item.id === openLetterId) ?? null;

  const vendorConsequence = (id: string) => {
    const linked = data.correspondence.filter((item) => item.counterpartyId === id).length;
    return linked
      ? `${linked} correspondence item${linked === 1 ? '' : 's'} reference this vendor; they are kept but will lose the link.`
      : undefined;
  };

  const removeVendor = (id: string) =>
    setData((current) => ({ ...current, vendors: current.vendors.filter((item) => item.id !== id) }));
  const removeLetter = (id: string) =>
    setData((current) => ({
      ...current,
      correspondence: current.correspondence.filter((item) => item.id !== id),
    }));

  return (
    <ViewShell
      title="Vendors & Correspondence"
      icon={Mail}
      subtitle="Supplier relationships, renewals, notice periods, incoming letters, responses, and filing state."
      bodyClassName="space-y-4 p-4"
      toolbar={
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search vendors and correspondence…"
            label="Search vendors and correspondence"
          />
        </Toolbar>
      }
    >
      <Panel
        title="Vendors"
        icon={Truck}
        description={`${vendors.length} of ${data.vendors.length} shown`}
        actions={
          <PopoverEditor title="Add vendor">
            <VendorFields draft={vendorForm} setDraft={setVendorForm} />
            <Button onClick={addVendor} disabled={!vendorForm.name.trim()}>
              <Plus className="size-4" aria-hidden="true" />
              Add vendor
            </Button>
          </PopoverEditor>
        }
      >
        <FilterChips
          label="Filter vendors by status"
          value={vendorStatus}
          onChange={setVendorStatus}
          options={chipOptions(VENDOR_STATUSES, data.vendors, data.vendors.length)}
          className="mb-3"
        />
        {vendors.length === 0 ? (
          <EmptyPanel
            icon={Truck}
            title={data.vendors.length === 0 ? 'No vendors yet' : 'No vendors match'}
            description={
              data.vendors.length === 0
                ? 'Track suppliers with their renewal date and the notice period you must respect.'
                : 'Try another search or status filter.'
            }
          />
        ) : (
          <CardGrid className="xl:grid-cols-2">
            {vendors.map((item) => (
              <RecordCard
                key={item.id}
                title={item.name}
                onOpen={() => setOpenVendorId(item.id)}
                badges={
                  <>
                    <Badge variant="secondary">{item.category || 'Vendor'}</Badge>
                    <StatusBadge status={item.status} overrides={BUSINESS_STATUS_TONES} />
                  </>
                }
                detail={
                  <>
                    <p>{item.email || 'No contact email'}</p>
                    <p>
                      {item.renewalDate ? `Renews ${item.renewalDate}` : 'No renewal date'}
                      {item.noticePeriod ? ` · notice ${item.noticePeriod}` : ''}
                    </p>
                  </>
                }
                actions={
                  <ConfirmDelete
                    itemName={item.name}
                    itemLabel="vendor"
                    onDelete={() => removeVendor(item.id)}
                    consequence={vendorConsequence(item.id)}
                  />
                }
              />
            ))}
          </CardGrid>
        )}
      </Panel>

      <Panel
        title="Correspondence"
        icon={Mail}
        description={`${letters.length} of ${data.correspondence.length} shown`}
        actions={
          <PopoverEditor title="Log correspondence">
            <CorrespondenceFields
              draft={letterForm}
              setDraft={setLetterForm}
              clients={data.clients}
              vendors={data.vendors}
            />
            <Button onClick={addLetter} disabled={!letterForm.subject.trim()}>
              <Plus className="size-4" aria-hidden="true" />
              Log correspondence
            </Button>
          </PopoverEditor>
        }
        bodyClassName="p-3 pt-0"
      >
        <FilterChips
          label="Filter correspondence by status"
          value={letterStatus}
          onChange={setLetterStatus}
          options={chipOptions(CORRESPONDENCE_STATUSES, data.correspondence, data.correspondence.length)}
          className="py-3"
        />
        {letters.length === 0 ? (
          <EmptyPanel
            icon={Mail}
            title={data.correspondence.length === 0 ? 'No correspondence yet' : 'Nothing matches'}
            description={
              data.correspondence.length === 0
                ? 'Log inbound letters with a response deadline so they surface in the planner.'
                : 'Try another search or status filter.'
            }
          />
        ) : (
          <ListRows className="-mx-3">
            {letters.map((item) => (
              <ListRow
                key={item.id}
                title={item.subject}
                onOpen={() => setOpenLetterId(item.id)}
                detail={
                  <>
                    {counterpartyName(item)} · {item.date}
                    {item.dueDate ? ` · respond by ${item.dueDate}` : ''}
                  </>
                }
                leading={<Badge variant="secondary">{item.direction}</Badge>}
                meta={<StatusBadge status={item.status} overrides={BUSINESS_STATUS_TONES} />}
                actions={
                  <ConfirmDelete
                    itemName={item.subject}
                    itemLabel="correspondence item"
                    onDelete={() => removeLetter(item.id)}
                    consequence="Its response deadline disappears from the planner and calendar."
                  />
                }
              />
            ))}
          </ListRows>
        )}
      </Panel>

      <RecordSheet
        record={openVendor}
        onClose={() => setOpenVendorId(null)}
        title={openVendor?.name ?? ''}
        subtitle={openVendor?.category || undefined}
        badges={openVendor && <StatusBadge status={openVendor.status} overrides={BUSINESS_STATUS_TONES} />}
        renderEdit={(current, setCurrent) => <VendorFields draft={current} setDraft={setCurrent} />}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            vendors: current.vendors.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          openVendor && (
            <ConfirmDelete
              itemName={openVendor.name}
              itemLabel="vendor"
              onDelete={() => {
                removeVendor(openVendor.id);
                setOpenVendorId(null);
              }}
              consequence={vendorConsequence(openVendor.id)}
            />
          )
        }
      >
        {openVendor && (
          <FactGrid>
            <Fact label="Email" value={openVendor.email} />
            <Fact label="Category" value={openVendor.category} />
            <Fact label="Renewal" value={openVendor.renewalDate} emphasis placeholder="No renewal date" />
            <Fact label="Contract end" value={openVendor.contractEnd} placeholder="Open ended" />
            <Fact
              label="Notice period"
              value={openVendor.noticePeriod}
              wide
              placeholder="Not recorded — cancellation risk"
            />
            <Fact label="Notes" value={openVendor.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>

      <RecordSheet
        record={openLetter}
        onClose={() => setOpenLetterId(null)}
        title={openLetter?.subject ?? ''}
        subtitle={openLetter ? `${openLetter.direction} · ${counterpartyName(openLetter)}` : undefined}
        badges={openLetter && <StatusBadge status={openLetter.status} overrides={BUSINESS_STATUS_TONES} />}
        renderEdit={(current, setCurrent) => (
          <CorrespondenceFields
            draft={current}
            setDraft={setCurrent}
            clients={data.clients}
            vendors={data.vendors}
          />
        )}
        onSave={(next) =>
          setData((current) => ({
            ...current,
            correspondence: current.correspondence.map((item) => (item.id === next.id ? next : item)),
          }))
        }
        actions={
          openLetter && (
            <ConfirmDelete
              itemName={openLetter.subject}
              itemLabel="correspondence item"
              onDelete={() => {
                removeLetter(openLetter.id);
                setOpenLetterId(null);
              }}
              consequence="Its response deadline disappears from the planner and calendar."
            />
          )
        }
      >
        {openLetter && (
          <FactGrid>
            <Fact label="Received / sent" value={openLetter.date} />
            <Fact
              label="Response due"
              value={openLetter.dueDate}
              emphasis
              placeholder="No response deadline"
            />
            <Fact label="Counterparty" value={counterpartyName(openLetter)} />
            <Fact label="Day block" value={blockLabel(openLetter.blockId)} placeholder="Unblocked" />
            <Fact label="Notes" value={openLetter.notes} wide />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

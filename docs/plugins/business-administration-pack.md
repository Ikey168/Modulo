# Business Administration

The Business Administration pack combines Modulo's existing German invoicing, bookkeeping, retention, time, and tax-automation tools with a complete administrative operating layer.

## New plugins

- **Business Directory** tracks companies, individual clients, contact details, VAT IDs, engagements, pipeline state, value, and next actions.
- **Proposals & Contracts** tracks proposals, quotes, contracts, SOWs, NDAs, DPAs, lifecycle state, expiry, and source-note references.
- **Expense Inbox & Reconciliation** creates an evidence and matching queue over existing Books expenses, invoices, bank entries, and other records. It does not replace the accounting ledger.
- **Filings & Obligations** manages tax filings, insurance, registrations, renewals, reports, authorities, references, and deadlines.
- **Vendors & Correspondence** manages suppliers, notice periods, renewal dates, incoming or outgoing correspondence, response deadlines, and filing state.
- **Business Command Center** combines administrative health with unpaid-invoice, unbilled-time, expense, reconciliation, filing, and correspondence signals.

## Existing plugins included

- Rechnung with German VAT modes and ZUGFeRD XML
- Zeiterfassung with invoice-line handoff
- Books with EÜR summaries and DATEV export
- GoBD Vault with retention and integrity tracking
- Tax Automation blueprint nodes
- Planner and Calendar

Filings and correspondence with an assigned day block appear in Planner and Calendar. Their records remain owned by the business administration store.

## Boundaries

The pack is local-first and adds no implicit connection to a bank, tax authority, email provider, or CRM. Reconciliation is an administrative matching workflow, not automated bank reconciliation. Tax summaries, retention defaults, and deadlines remain configurable operational aids and are not legal or tax advice.

// Rechnung — German invoicing (#364). Pure module: fence parsing, VAT-mode
// logic, §14 UStG field validation, sequential numbering, totals, and the
// EN 16931 (ZUGFeRD/Factur-X CII) XML payload. Kept free of React so the tax
// mechanics are unit-tested in isolation and easy to adjust after
// Steuerberater review. This encodes mechanics, not tax advice.

import type { CoreNote } from '@modulo/core';

// ── VAT modes ────────────────────────────────────────────────────────────────

export type VatMode = 'domestic' | 'eu-reverse-charge' | 'non-eu' | 'kleinunternehmer';

export interface VatModeInfo {
  mode: VatMode;
  label: string;
  /** VAT percentage applied to the net total. */
  rate: number;
  /** Mandatory invoice clause for this mode (German), if any. */
  clause?: string;
  /** EN 16931 VAT category code (BT-151). */
  categoryCode: 'S' | 'AE' | 'O' | 'E';
}

export const VAT_MODES: Record<VatMode, VatModeInfo> = {
  domestic: {
    mode: 'domestic',
    label: 'Domestic (19% USt)',
    rate: 19,
    categoryCode: 'S',
  },
  'eu-reverse-charge': {
    mode: 'eu-reverse-charge',
    label: 'EU B2B (reverse charge)',
    rate: 0,
    clause:
      'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, §13b UStG / Art. 196 MwStSystRL).',
    categoryCode: 'AE',
  },
  'non-eu': {
    mode: 'non-eu',
    label: 'Non-EU (not taxable in Germany)',
    rate: 0,
    clause: 'Nicht im Inland steuerbare sonstige Leistung (§3a Abs. 2 UStG).',
    categoryCode: 'O',
  },
  kleinunternehmer: {
    mode: 'kleinunternehmer',
    label: 'Kleinunternehmer (§19 UStG)',
    rate: 0,
    clause: 'Gemäß §19 UStG wird keine Umsatzsteuer berechnet.',
    categoryCode: 'E',
  },
};

// ── Data shapes ──────────────────────────────────────────────────────────────

export interface InvoiceLine {
  description: string;
  quantity: number;
  /** Net unit price in EUR. */
  unitPrice: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
export const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue'];

export interface Invoice {
  number: string;
  /** Issue date, YYYY-MM-DD. */
  date: string;
  /** Leistungsdatum/-zeitraum. */
  serviceDate?: string;
  dueDate?: string;
  status: InvoiceStatus;
  clientName: string;
  clientAddress?: string;
  clientVatId?: string;
  vatMode: VatMode;
  lines: InvoiceLine[];
  /** Crypto settlement record: EUR value at receipt (Zuflusszeitpunkt). */
  paidEur?: number;
  paidWith?: string;
  paidRate?: string;
}

/** The issuing business, persisted client-side once (see readSellerProfile). */
export interface SellerProfile {
  name: string;
  address: string;
  /** Steuernummer. */
  taxNumber?: string;
  /** USt-IdNr. */
  vatId?: string;
  iban?: string;
  email?: string;
}

export interface InvoiceParseError {
  error: string;
}

export function isInvoiceError(v: Invoice | InvoiceParseError): v is InvoiceParseError {
  return 'error' in v;
}

// ── Fence parsing ────────────────────────────────────────────────────────────
// ```invoice
// number: 2026-001
// date: 2026-07-21
// due: 2026-08-04
// service-date: 2026-07
// status: sent
// client: Acme Labs Ltd
// client-address: 1 Main Street, London, UK
// client-vat-id: GB123456789
// vat-mode: eu-reverse-charge
// line: Smart contract audit (Vault.sol) | 1 | 8000
// line: Fix review | 4 | 150
// ```

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseInvoice(source: string): Invoice | InvoiceParseError {
  const header: Record<string, string> = {};
  const lines: InvoiceLine[] = [];

  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const m = /^([a-zA-Z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'line') {
      const parts = value.split('|').map((p) => p.trim());
      const [description, qtyRaw = '1', priceRaw = '0'] = parts;
      const quantity = Number(qtyRaw.replace(',', '.'));
      const unitPrice = Number(priceRaw.replace(',', '.'));
      if (!description || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
        return { error: `Invalid line "${value}". Use: line: description | quantity | net unit price` };
      }
      lines.push({ description, quantity, unitPrice });
    } else {
      header[key] = value;
    }
  }

  if (!header['number']) return { error: 'An invoice needs a `number:` (fortlaufende Rechnungsnummer).' };
  if (!header['date']) return { error: 'An invoice needs a `date:` (YYYY-MM-DD).' };
  if (!DATE_RE.test(header['date'])) return { error: `Invalid date "${header['date']}" — use YYYY-MM-DD.` };
  if (!header['client']) return { error: 'An invoice needs a `client:` name.' };

  const vatModeRaw = (header['vat-mode'] ?? 'domestic') as VatMode;
  if (!(vatModeRaw in VAT_MODES)) {
    return { error: `Unknown vat-mode "${header['vat-mode']}". Use: ${Object.keys(VAT_MODES).join(', ')}.` };
  }
  const statusRaw = (header['status'] ?? 'draft') as InvoiceStatus;
  if (!INVOICE_STATUSES.includes(statusRaw)) {
    return { error: `Unknown status "${header['status']}". Use: ${INVOICE_STATUSES.join(', ')}.` };
  }

  const paidEur = header['paid-eur'] ? Number(header['paid-eur'].replace(',', '.')) : undefined;
  if (paidEur !== undefined && !Number.isFinite(paidEur)) {
    return { error: `Invalid paid-eur "${header['paid-eur']}".` };
  }

  return {
    number: header['number'],
    date: header['date'],
    serviceDate: header['service-date'],
    dueDate: header['due'],
    status: statusRaw,
    clientName: header['client'],
    clientAddress: header['client-address'],
    clientVatId: header['client-vat-id'],
    vatMode: vatModeRaw,
    lines,
    paidEur,
    paidWith: header['paid-with'],
    paidRate: header['paid-rate'],
  };
}

// ── Totals ───────────────────────────────────────────────────────────────────

export interface InvoiceTotals {
  net: number;
  vatRate: number;
  vat: number;
  gross: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeTotals(invoice: Invoice): InvoiceTotals {
  const net = round2(invoice.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
  const vatRate = VAT_MODES[invoice.vatMode].rate;
  const vat = round2((net * vatRate) / 100);
  return { net, vatRate, vat, gross: round2(net + vat) };
}

export const formatEur = (n: number): string =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);

// ── §14 UStG validation ──────────────────────────────────────────────────────

/** Human-readable list of missing/invalid §14 UStG fields. Empty = complete. */
export function validateInvoice(invoice: Invoice, seller: SellerProfile | null): string[] {
  const missing: string[] = [];
  if (!seller?.name) missing.push('Seller name (vollständiger Name des leistenden Unternehmers)');
  if (!seller?.address) missing.push('Seller address (Anschrift)');
  if (!seller?.taxNumber && !seller?.vatId) missing.push('Seller Steuernummer or USt-IdNr');
  if (!invoice.clientAddress) missing.push('Client address (Anschrift des Leistungsempfängers)');
  if (invoice.lines.length === 0) missing.push('Line items (Menge und Art der Leistung)');
  if (!invoice.serviceDate) missing.push('Service date/period (Leistungsdatum, service-date:)');
  if (invoice.vatMode === 'eu-reverse-charge') {
    if (!invoice.clientVatId) missing.push('Client USt-IdNr (required for reverse charge)');
    if (!seller?.vatId) missing.push('Seller USt-IdNr (required for reverse charge)');
  }
  return missing;
}

// ── Sequential numbering ─────────────────────────────────────────────────────

/** Next number in the `YYYY-NNN` sequence for the given year, gap-free by
 *  construction (max + 1). Numbers from other years are ignored. */
export function nextInvoiceNumber(existing: string[], year: number): string {
  let max = 0;
  const re = new RegExp(`^${year}-(\\d+)$`);
  for (const n of existing) {
    const m = re.exec(n.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${year}-${String(max + 1).padStart(3, '0')}`;
}

// ── Vault scan ───────────────────────────────────────────────────────────────

export interface NoteInvoice {
  invoice: Invoice;
  noteId: number;
  noteTitle: string;
}

const FENCE_RE = /```invoice[^\S\n]*\n([\s\S]*?)```/g;

export function extractInvoices(notes: CoreNote[]): NoteInvoice[] {
  const out: NoteInvoice[] = [];
  for (const note of notes) {
    const body = note.markdownContent ?? note.content ?? '';
    for (const m of body.matchAll(FENCE_RE)) {
      const parsed = parseInvoice(m[1]);
      if (!isInvoiceError(parsed)) out.push({ invoice: parsed, noteId: note.id, noteTitle: note.title });
    }
  }
  return out.sort((a, b) => b.invoice.number.localeCompare(a.invoice.number));
}

// ── Seller profile persistence ───────────────────────────────────────────────

const SELLER_KEY = 'modulo-invoice-seller';

export function readSellerProfile(): SellerProfile | null {
  try {
    const raw = localStorage.getItem(SELLER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.name !== 'string' || typeof p.address !== 'string') return null;
    return p as unknown as SellerProfile;
  } catch {
    return null;
  }
}

export function writeSellerProfile(profile: SellerProfile): void {
  try {
    localStorage.setItem(SELLER_KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable — validation will keep flagging the seller fields.
  }
}

// ── EN 16931 (ZUGFeRD / Factur-X) XML ────────────────────────────────────────
// The UN/CEFACT CII payload of a ZUGFeRD invoice (EN 16931 profile). Embedding
// it into a PDF/A-3 container needs a PDF writer and is a documented follow-up;
// the XML is the machine-readable half validators and AP systems consume.

const xml = (s: string | undefined): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ccyDate = (isoDate: string): string => isoDate.replace(/-/g, '');

export function zugferdXml(invoice: Invoice, seller: SellerProfile): string {
  const totals = computeTotals(invoice);
  const info = VAT_MODES[invoice.vatMode];
  const linesXml = invoice.lines
    .map(
      (l, i) => `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${xml(l.description)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>${l.unitPrice.toFixed(2)}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${l.quantity}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${info.categoryCode}</ram:CategoryCode><ram:RateApplicablePercent>${info.rate.toFixed(2)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${(l.quantity * l.unitPrice).toFixed(2)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xml(invoice.number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${ccyDate(invoice.date)}</udt:DateTimeString></ram:IssueDateTime>${
      info.clause
        ? `\n    <ram:IncludedNote><ram:Content>${xml(info.clause)}</ram:Content></ram:IncludedNote>`
        : ''
    }
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${linesXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${xml(seller.name)}</ram:Name>
        <ram:PostalTradeAddress><ram:LineOne>${xml(seller.address)}</ram:LineOne><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>${
          seller.vatId
            ? `\n        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xml(seller.vatId)}</ram:ID></ram:SpecifiedTaxRegistration>`
            : ''
        }${
          seller.taxNumber
            ? `\n        <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${xml(seller.taxNumber)}</ram:ID></ram:SpecifiedTaxRegistration>`
            : ''
        }
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xml(invoice.clientName)}</ram:Name>${
          invoice.clientAddress
            ? `\n        <ram:PostalTradeAddress><ram:LineOne>${xml(invoice.clientAddress)}</ram:LineOne></ram:PostalTradeAddress>`
            : ''
        }${
          invoice.clientVatId
            ? `\n        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xml(invoice.clientVatId)}</ram:ID></ram:SpecifiedTaxRegistration>`
            : ''
        }
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${totals.vat.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${totals.net.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>${info.categoryCode}</ram:CategoryCode>
        <ram:RateApplicablePercent>${info.rate.toFixed(2)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${totals.net.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${totals.net.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${totals.vat.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${totals.gross.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${totals.gross.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

/** Starter fence for the editor action / new-invoice flow. */
export function invoiceTemplate(number: string, date: string): string {
  return `\`\`\`invoice
number: ${number}
date: ${date}
service-date: ${date.slice(0, 7)}
due: ${date}
status: draft
client: Client name
client-address: Street, City, Country
client-vat-id:
vat-mode: eu-reverse-charge
line: Smart contract audit | 1 | 8000
\`\`\``;
}

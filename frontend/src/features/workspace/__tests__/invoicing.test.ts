import { beforeEach, describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import {
  computeTotals,
  extractInvoices,
  isInvoiceError,
  nextInvoiceNumber,
  parseInvoice,
  readSellerProfile,
  validateInvoice,
  writeSellerProfile,
  zugferdXml,
  type Invoice,
  type SellerProfile,
} from '../invoicing';

const SELLER: SellerProfile = {
  name: 'Audit GmbH',
  address: 'Beispielstr. 1, 10115 Berlin',
  taxNumber: '12/345/67890',
  vatId: 'DE123456789',
};

const SOURCE = `number: 2026-007
date: 2026-07-21
service-date: 2026-07
due: 2026-08-04
status: sent
client: Acme Labs Ltd
client-address: 1 Main Street, London, UK
client-vat-id: GB123456789
vat-mode: eu-reverse-charge
line: Smart contract audit (Vault.sol) | 1 | 8000
line: Fix review | 4 | 150,50`;

function parsed(source = SOURCE): Invoice {
  const p = parseInvoice(source);
  if (isInvoiceError(p)) throw new Error(p.error);
  return p;
}

beforeEach(() => localStorage.clear());

describe('parseInvoice', () => {
  it('parses header fields and line items (with comma decimals)', () => {
    const inv = parsed();
    expect(inv.number).toBe('2026-007');
    expect(inv.vatMode).toBe('eu-reverse-charge');
    expect(inv.lines).toEqual([
      { description: 'Smart contract audit (Vault.sol)', quantity: 1, unitPrice: 8000 },
      { description: 'Fix review', quantity: 4, unitPrice: 150.5 },
    ]);
  });

  it('rejects missing number/date/client and bad enums', () => {
    expect(isInvoiceError(parseInvoice('date: 2026-01-01\nclient: X'))).toBe(true);
    expect(isInvoiceError(parseInvoice('number: 1\nclient: X'))).toBe(true);
    expect(isInvoiceError(parseInvoice('number: 1\ndate: 21.07.2026\nclient: X'))).toBe(true);
    expect(isInvoiceError(parseInvoice('number: 1\ndate: 2026-01-01'))).toBe(true);
    expect(isInvoiceError(parseInvoice('number: 1\ndate: 2026-01-01\nclient: X\nvat-mode: exotic'))).toBe(true);
    expect(isInvoiceError(parseInvoice('number: 1\ndate: 2026-01-01\nclient: X\nstatus: lost'))).toBe(true);
  });
});

describe('computeTotals per VAT mode', () => {
  const base = () => parsed();

  it('domestic applies 19%', () => {
    const t = computeTotals({ ...base(), vatMode: 'domestic' });
    expect(t.net).toBe(8602);
    expect(t.vat).toBe(1634.38);
    expect(t.gross).toBe(10236.38);
  });

  it('reverse charge, non-EU and Kleinunternehmer apply 0%', () => {
    for (const mode of ['eu-reverse-charge', 'non-eu', 'kleinunternehmer'] as const) {
      const t = computeTotals({ ...base(), vatMode: mode });
      expect(t.vat).toBe(0);
      expect(t.gross).toBe(t.net);
    }
  });
});

describe('validateInvoice (§14 UStG)', () => {
  it('passes a complete reverse-charge invoice', () => {
    expect(validateInvoice(parsed(), SELLER)).toEqual([]);
  });

  it('flags missing seller data, client address, lines, service date', () => {
    const inv = parsed('number: 1\ndate: 2026-01-01\nclient: X');
    const missing = validateInvoice(inv, null);
    expect(missing.join(' ')).toMatch(/Seller name/);
    expect(missing.join(' ')).toMatch(/Steuernummer/);
    expect(missing.join(' ')).toMatch(/Client address/);
    expect(missing.join(' ')).toMatch(/Line items/);
    expect(missing.join(' ')).toMatch(/Leistungsdatum/);
  });

  it('requires both VAT ids for reverse charge', () => {
    const inv = { ...parsed(), clientVatId: undefined };
    expect(validateInvoice(inv, { ...SELLER, vatId: undefined }).join(' ')).toMatch(/Client USt-IdNr.*Seller USt-IdNr|USt-IdNr/);
  });
});

describe('nextInvoiceNumber', () => {
  it('continues the max for the year, per year, zero-padded', () => {
    expect(nextInvoiceNumber([], 2026)).toBe('2026-001');
    expect(nextInvoiceNumber(['2026-001', '2026-007', '2025-099'], 2026)).toBe('2026-008');
    expect(nextInvoiceNumber(['2026-007'], 2027)).toBe('2027-001');
  });
});

describe('extractInvoices', () => {
  const note = (id: number, content: string): CoreNote => ({ id, title: `N${id}`, content, tags: [] });

  it('scans fences across notes and skips malformed ones', () => {
    const notes = [
      note(1, '```invoice\n' + SOURCE + '\n```'),
      note(2, '```invoice\nnumber: broken\n```'),
      note(3, 'no fence'),
    ];
    const found = extractInvoices(notes);
    expect(found).toHaveLength(1);
    expect(found[0].invoice.number).toBe('2026-007');
  });
});

describe('seller profile persistence', () => {
  it('round-trips and rejects corrupt storage', () => {
    expect(readSellerProfile()).toBeNull();
    writeSellerProfile(SELLER);
    expect(readSellerProfile()?.vatId).toBe('DE123456789');
    localStorage.setItem('modulo-invoice-seller', '{ nope');
    expect(readSellerProfile()).toBeNull();
  });
});

describe('zugferdXml', () => {
  it('emits an EN 16931 CII document with the right totals, category and clause', () => {
    const x = zugferdXml(parsed(), SELLER);
    expect(x).toContain('urn:cen.eu:en16931:2017');
    expect(x).toContain('<ram:ID>2026-007</ram:ID>');
    expect(x).toContain('<ram:TypeCode>380</ram:TypeCode>');
    expect(x).toContain('format="102">20260721<');
    expect(x).toContain('<ram:CategoryCode>AE</ram:CategoryCode>');
    expect(x).toContain('Steuerschuldnerschaft des Leistungsempfängers');
    expect(x).toContain('<ram:GrandTotalAmount>8602.00</ram:GrandTotalAmount>');
    expect(x).toContain('<ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>');
    expect(x).toContain('schemeID="VA">GB123456789');
  });

  it('escapes XML-unsafe characters', () => {
    const inv = { ...parsed(), clientName: 'A & B <Ltd>' };
    const x = zugferdXml(inv, SELLER);
    expect(x).toContain('A &amp; B &lt;Ltd&gt;');
  });

  it('uses S/19% for domestic invoices', () => {
    const x = zugferdXml({ ...parsed(), vatMode: 'domestic' }, SELLER);
    expect(x).toContain('<ram:CategoryCode>S</ram:CategoryCode>');
    expect(x).toContain('<ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>');
    expect(x).toContain('<ram:GrandTotalAmount>10236.38</ram:GrandTotalAmount>');
  });
});

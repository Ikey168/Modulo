package com.modulo.blueprint.interpreter;

import com.modulo.entity.Note;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InvoiceFenceParserTest {

    private Note note(Long id, String content) {
        Note n = new Note();
        n.setId(id);
        n.setContent(content);
        return n;
    }

    private static final String INVOICE =
        "```invoice\nnumber: 2026-007\ndate: 2026-06-01\ndue: 2026-06-15\nstatus: sent\nclient: Acme Labs\n```";

    @Test
    void parsesTheFieldsChasingNeeds() {
        List<InvoiceFenceParser.ParsedInvoice> parsed = InvoiceFenceParser.parse(List.of(note(1L, INVOICE)));
        assertThat(parsed).hasSize(1);
        InvoiceFenceParser.ParsedInvoice invoice = parsed.get(0);
        assertThat(invoice.number()).isEqualTo("2026-007");
        assertThat(invoice.client()).isEqualTo("Acme Labs");
        assertThat(invoice.status()).isEqualTo("sent");
        assertThat(invoice.due()).isEqualTo(LocalDate.of(2026, 6, 15));
        assertThat(invoice.noteId()).isEqualTo(1L);
    }

    @Test
    void skipsFencesWithoutNumberAndToleratesBadDates() {
        String bad = "```invoice\ndate: 2026-06-01\n```\n```invoice\nnumber: X\ndue: someday\nstatus: sent\n```";
        List<InvoiceFenceParser.ParsedInvoice> parsed = InvoiceFenceParser.parse(List.of(note(1L, bad)));
        assertThat(parsed).hasSize(1);
        assertThat(parsed.get(0).number()).isEqualTo("X");
        assertThat(parsed.get(0).due()).isNull();
    }

    @Test
    void overdueSelectsPastDueAwaitingPaymentOnly() {
        LocalDate today = LocalDate.of(2026, 7, 21);
        String paid = "```invoice\nnumber: A\ndue: 2026-06-15\nstatus: paid\n```";
        String future = "```invoice\nnumber: B\ndue: 2026-08-15\nstatus: sent\n```";
        String overdueMarked = "```invoice\nnumber: C\ndue: 2026-06-15\nstatus: overdue\n```";
        List<InvoiceFenceParser.ParsedInvoice> overdue = InvoiceFenceParser.overdue(
            List.of(note(1L, INVOICE), note(2L, paid), note(3L, future), note(4L, overdueMarked)), today);
        assertThat(overdue).extracting(InvoiceFenceParser.ParsedInvoice::number)
            .containsExactly("2026-007", "C");
    }
}

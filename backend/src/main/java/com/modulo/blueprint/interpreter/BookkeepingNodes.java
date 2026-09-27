package com.modulo.blueprint.interpreter;

import com.modulo.entity.Note;
import com.modulo.service.ViesService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Built-in bookkeeping nodes (#367): {@code action.tax.deadline.reminder},
 * {@code action.invoice.chase} and {@code action.vies.check}.
 */
final class BookkeepingNodes {

    private final InterpreterDependencies deps;

    BookkeepingNodes(InterpreterDependencies deps) {
        this.deps = deps;
    }

    /**
     * Next USt-VA and ZM deadlines from the configured cadence; one reminder note
     * per deadline (deduped by title).
     */
    NodeResult deadlineReminder(Map<String, Object> config) {
        Map<String, Object> outputs = new HashMap<>();
        boolean quarterly = config != null && "quarterly".equals(config.get("cadence"));
        boolean dauerfrist = config != null && Boolean.TRUE.equals(config.get("dauerfrist"));
        java.time.LocalDate today = java.time.LocalDate.now();
        TaxDeadlines.Deadline ustva = TaxDeadlines.nextUstVa(today, quarterly, dauerfrist);
        TaxDeadlines.Deadline zm = TaxDeadlines.nextZm(today, false);
        String deadlines = "USt-VA " + ustva.period() + " fällig " + ustva.due()
            + "; ZM " + zm.period() + " fällig " + zm.due();
        String title = "Steuertermine — USt-VA " + ustva.period() + " fällig " + ustva.due();
        Note reminder = null;
        if (deps.noteService().searchNotes(title, null, null, 1, 0).isEmpty()) {
            reminder = new Note();
            reminder.setTitle(title);
            reminder.setContent("## Steuertermine\n\n- USt-VA " + ustva.period() + ": fällig " + ustva.due()
                + (dauerfrist ? " (mit Dauerfristverlängerung)" : "")
                + "\n- Zusammenfassende Meldung " + zm.period() + ": fällig " + zm.due()
                + "\n\nMechanik, keine Steuerberatung — Termine mit dem Steuerberater abgleichen.\n");
            reminder.getTags().add(deps.tagService().createOrGetTag("tax/deadline"));
            reminder = deps.noteService().save(reminder);
        }
        outputs.put("deadlines", deadlines);
        outputs.put("note", reminder);
        return new NodeResult(outputs, "then");
    }

    /** Draft Zahlungserinnerungen for past-due invoices. Drafts only: nothing is ever sent automatically. */
    NodeResult chaseInvoices() {
        Map<String, Object> outputs = new HashMap<>();
        java.time.LocalDate today = java.time.LocalDate.now();
        List<Note> allNotes = deps.noteService().findAll(0, 500);
        List<InvoiceFenceParser.ParsedInvoice> overdueInvoices =
            InvoiceFenceParser.overdue(allNotes, today);
        int created = 0;
        for (InvoiceFenceParser.ParsedInvoice invoice : overdueInvoices) {
            String title = "Zahlungserinnerung — Rechnung " + invoice.number();
            if (!deps.noteService().searchNotes(title, null, null, 1, 0).isEmpty()) continue;
            Note draft = new Note();
            draft.setTitle(title);
            draft.setContent("## Zahlungserinnerung (Entwurf)\n\nRechnung " + invoice.number()
                + " an " + invoice.client() + " war am " + invoice.due()
                + " fällig und ist noch offen.\n\n"
                + "Sehr geehrte Damen und Herren,\n\n"
                + "auf unsere Rechnung " + invoice.number() + " vom Fälligkeitsdatum " + invoice.due()
                + " ist bisher kein Zahlungseingang zu verzeichnen. Wir bitten um Ausgleich "
                + "innerhalb von 7 Tagen. Sollte sich die Zahlung mit dieser Erinnerung "
                + "überschnitten haben, betrachten Sie dieses Schreiben als gegenstandslos.\n\n"
                + "Mit freundlichen Grüßen\n");
            draft.getTags().add(deps.tagService().createOrGetTag("invoice/chase"));
            deps.noteService().save(draft);
            created++;
        }
        outputs.put("overdueCount", String.valueOf(overdueInvoices.size()));
        outputs.put("draftsCreated", String.valueOf(created));
        return new NodeResult(outputs, "then");
    }

    /** VIES USt-IdNr validation; degrades to 'unverified' when the service is unreachable and never blocks the flow. */
    NodeResult viesCheck(Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        String vatId = String.valueOf(inputs.getOrDefault("vatId", "")).trim();
        ViesService.ViesResult result = deps.viesService().check(vatId);
        String status;
        switch (result) {
            case VALID: status = "valid"; break;
            case INVALID: status = "invalid"; break;
            default: status = "unverified"; break;
        }
        outputs.put("valid", result == ViesService.ViesResult.VALID);
        outputs.put("status", status);
        outputs.put("checkedAt", LocalDateTime.now().toString());
        return new NodeResult(outputs, "then");
    }
}

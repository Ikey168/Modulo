package com.modulo.blueprint.interpreter;

import com.modulo.entity.Note;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses the ```invoice fences the Rechnung plugin (#364) authors into note
 * bodies, for the payment-chase automation (#367). Mirrors the frontend
 * parser's header conventions; only the fields chasing needs are extracted.
 */
public final class InvoiceFenceParser {

    private static final Pattern FENCE = Pattern.compile("```invoice[^\\S\\n]*\\n(.*?)```", Pattern.DOTALL);
    private static final Pattern HEADER = Pattern.compile("^([a-zA-Z-]+)\\s*:\\s*(.*)$", Pattern.MULTILINE);

    public record ParsedInvoice(String number, String client, String status, LocalDate due, Long noteId) {}

    private InvoiceFenceParser() {}

    /** All parseable invoice fences across the notes. */
    public static List<ParsedInvoice> parse(Collection<Note> notes) {
        List<ParsedInvoice> out = new ArrayList<>();
        for (Note note : notes) {
            String body = note.getContent();
            if (body == null || body.isEmpty()) continue;
            Matcher fences = FENCE.matcher(body);
            while (fences.find()) {
                String number = null, client = null, status = "draft", dueRaw = null;
                Matcher headers = HEADER.matcher(fences.group(1));
                while (headers.find()) {
                    String key = headers.group(1).toLowerCase(Locale.ROOT);
                    String value = headers.group(2).trim();
                    switch (key) {
                        case "number": number = value; break;
                        case "client": client = value; break;
                        case "status": status = value.toLowerCase(Locale.ROOT); break;
                        case "due": dueRaw = value; break;
                        default: break;
                    }
                }
                if (number == null || number.isBlank()) continue;
                LocalDate due = null;
                if (dueRaw != null && !dueRaw.isBlank()) {
                    try {
                        due = LocalDate.parse(dueRaw);
                    } catch (DateTimeParseException ignored) {
                        // Unparseable due date — the invoice can't be chased by date.
                    }
                }
                out.add(new ParsedInvoice(number, client != null ? client : "", status, due, note.getId()));
            }
        }
        return out;
    }

    /** Invoices past due that are still awaiting payment (sent or overdue). */
    public static List<ParsedInvoice> overdue(Collection<Note> notes, LocalDate today) {
        List<ParsedInvoice> out = new ArrayList<>();
        for (ParsedInvoice invoice : parse(notes)) {
            boolean awaiting = "sent".equals(invoice.status()) || "overdue".equals(invoice.status());
            if (awaiting && invoice.due() != null && invoice.due().isBefore(today)) {
                out.add(invoice);
            }
        }
        return out;
    }
}

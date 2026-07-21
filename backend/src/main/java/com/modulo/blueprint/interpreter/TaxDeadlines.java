package com.modulo.blueprint.interpreter;

import java.time.LocalDate;

/**
 * German filing-deadline arithmetic for the tax automation nodes (#367).
 * Pure and unit-tested; cadence (monthly/quarterly) and Dauerfristverlängerung
 * are configuration — nothing here hardcodes a taxpayer's situation. Mechanics,
 * not tax advice: deadlines follow §18 UStG (10th of the following month, +1
 * month with Dauerfristverlängerung) and §18a UStG for the ZM (25th).
 */
public final class TaxDeadlines {

    public record Deadline(String period, LocalDate due) {}

    private TaxDeadlines() {}

    /** End of the current USt-VA period containing {@code today}. */
    private static LocalDate periodEnd(LocalDate today, boolean quarterly) {
        if (!quarterly) {
            return today.withDayOfMonth(today.lengthOfMonth());
        }
        int endMonth = ((today.getMonthValue() - 1) / 3) * 3 + 3;
        LocalDate end = LocalDate.of(today.getYear(), endMonth, 1);
        return end.withDayOfMonth(end.lengthOfMonth());
    }

    private static String periodLabel(LocalDate periodEnd, boolean quarterly) {
        if (!quarterly) {
            return String.format("%d-%02d", periodEnd.getYear(), periodEnd.getMonthValue());
        }
        return periodEnd.getYear() + "-Q" + ((periodEnd.getMonthValue() - 1) / 3 + 1);
    }

    /**
     * The next USt-Voranmeldung deadline on or after {@code today}: the 10th of
     * the month following the period (+1 month with Dauerfristverlängerung).
     */
    public static Deadline nextUstVa(LocalDate today, boolean quarterly, boolean dauerfrist) {
        LocalDate end = periodEnd(today, quarterly);
        LocalDate due = end.plusDays(1).withDayOfMonth(10).plusMonths(dauerfrist ? 1 : 0);
        // The current period's deadline may already be past early in a period
        // only when dauerfrist shifts things; walk forward until due >= today.
        while (due.isBefore(today)) {
            LocalDate nextPeriodStart = end.plusDays(1);
            end = periodEnd(nextPeriodStart, quarterly);
            due = end.plusDays(1).withDayOfMonth(10).plusMonths(dauerfrist ? 1 : 0);
        }
        return new Deadline(periodLabel(end, quarterly), due);
    }

    /**
     * The next Zusammenfassende Meldung deadline: the 25th after the end of
     * the reporting period (quarterly by default, §18a UStG).
     */
    public static Deadline nextZm(LocalDate today, boolean monthly) {
        LocalDate end = periodEnd(today, !monthly);
        LocalDate due = end.plusDays(1).withDayOfMonth(25);
        while (due.isBefore(today)) {
            LocalDate nextPeriodStart = end.plusDays(1);
            end = periodEnd(nextPeriodStart, !monthly);
            due = end.plusDays(1).withDayOfMonth(25);
        }
        return new Deadline(periodLabel(end, !monthly), due);
    }
}

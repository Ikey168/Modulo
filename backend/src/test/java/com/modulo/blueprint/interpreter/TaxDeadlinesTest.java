package com.modulo.blueprint.interpreter;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class TaxDeadlinesTest {

    @Test
    void monthlyUstVaIsDueOnTheTenthOfTheFollowingMonth() {
        TaxDeadlines.Deadline d = TaxDeadlines.nextUstVa(LocalDate.of(2026, 7, 21), false, false);
        assertThat(d.period()).isEqualTo("2026-07");
        assertThat(d.due()).isEqualTo(LocalDate.of(2026, 8, 10));
    }

    @Test
    void dauerfristShiftsTheDeadlineOneMonth() {
        TaxDeadlines.Deadline d = TaxDeadlines.nextUstVa(LocalDate.of(2026, 7, 21), false, true);
        assertThat(d.period()).isEqualTo("2026-07");
        assertThat(d.due()).isEqualTo(LocalDate.of(2026, 9, 10));
    }

    @Test
    void quarterlyUstVaUsesQuarterPeriods() {
        TaxDeadlines.Deadline d = TaxDeadlines.nextUstVa(LocalDate.of(2026, 7, 1), true, false);
        assertThat(d.period()).isEqualTo("2026-Q3");
        assertThat(d.due()).isEqualTo(LocalDate.of(2026, 10, 10));
    }

    @Test
    void yearBoundaryRollsIntoJanuary() {
        TaxDeadlines.Deadline d = TaxDeadlines.nextUstVa(LocalDate.of(2026, 12, 15), false, false);
        assertThat(d.period()).isEqualTo("2026-12");
        assertThat(d.due()).isEqualTo(LocalDate.of(2027, 1, 10));
    }

    @Test
    void zmIsDueOnTheTwentyFifthAfterTheQuarter() {
        TaxDeadlines.Deadline d = TaxDeadlines.nextZm(LocalDate.of(2026, 7, 21), false);
        assertThat(d.period()).isEqualTo("2026-Q3");
        assertThat(d.due()).isEqualTo(LocalDate.of(2026, 10, 25));
    }

    @Test
    void monthlyZmUsesMonthPeriods() {
        TaxDeadlines.Deadline d = TaxDeadlines.nextZm(LocalDate.of(2026, 7, 21), true);
        assertThat(d.period()).isEqualTo("2026-07");
        assertThat(d.due()).isEqualTo(LocalDate.of(2026, 8, 25));
    }
}

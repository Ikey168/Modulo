package com.modulo.blueprint.interpreter;

import com.modulo.entity.Note;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuditFenceParserTest {

    private Note note(String content) {
        Note n = new Note();
        n.setContent(content);
        return n;
    }

    @Test
    void parsesStatusesDefaultingToOpen() {
        String body = "intro\n"
            + "```finding\ntitle: A\nstatus: verified\n```\n"
            + "```finding\ntitle: B\nStatus: Fixed\n```\n"
            + "```finding\ntitle: C\n```\n"
            + "```finding\ntitle: D\nstatus: nonsense\n```\n";
        assertThat(AuditFenceParser.findingStatuses(body))
            .containsExactly("verified", "fixed", "open", "open");
    }

    @Test
    void handlesNullAndFencelessBodies() {
        assertThat(AuditFenceParser.findingStatuses(null)).isEmpty();
        assertThat(AuditFenceParser.findingStatuses("no fences")).isEmpty();
    }

    @Test
    void countsAcrossNotesInCanonicalOrder() {
        Map<String, Integer> counts = AuditFenceParser.countByStatus(List.of(
            note("```finding\ntitle: A\nstatus: open\n```"),
            note("```finding\ntitle: B\nstatus: open\n```\n```finding\ntitle: C\nstatus: verified\n```"),
            note("prose only")
        ));
        assertThat(counts.keySet()).containsExactly("open", "acknowledged", "fixed", "verified");
        assertThat(counts.get("open")).isEqualTo(2);
        assertThat(counts.get("verified")).isEqualTo(1);
        assertThat(counts.get("fixed")).isZero();
    }

    @Test
    void digestMarkdownListsTotalsAndPerStatusCounts() {
        String md = AuditFenceParser.digestMarkdown("acme-vault",
            AuditFenceParser.countByStatus(List.of(note("```finding\ntitle: A\nstatus: fixed\n```"))));
        assertThat(md).contains("Status digest — acme-vault");
        assertThat(md).contains("Total findings: 1");
        assertThat(md).contains("- fixed: 1");
    }
}

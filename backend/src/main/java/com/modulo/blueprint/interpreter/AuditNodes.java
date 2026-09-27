package com.modulo.blueprint.interpreter;

import com.modulo.note.Note;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Built-in audit pack nodes (#363): {@code action.audit.reaudit} and {@code action.audit.digest}. */
final class AuditNodes {

    private final InterpreterDependencies deps;

    AuditNodes(InterpreterDependencies deps) {
        this.deps = deps;
    }

    /** Re-audit intake: a fix-review note for the engagement, tagged so it lands in the pipeline's Fix Review column. */
    NodeResult reaudit(Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        String engagement = String.valueOf(inputs.getOrDefault("engagement", "")).trim();
        Note note = new Note();
        note.setTitle("Re-audit — " + engagement + " (" + java.time.LocalDate.now() + ")");
        note.setContent("## Re-audit intake\n\nClient pushed fixes for `" + engagement
            + "`.\n\nWebhook payload:\n\n```\n"
            + String.valueOf(inputs.getOrDefault("payload", "")) + "\n```\n\n- [ ] Verify each fixed finding\n");
        if (!engagement.isEmpty()) {
            note.getTags().add(deps.tagService().createOrGetTag("engagement/" + engagement));
        }
        note.getTags().add(deps.tagService().createOrGetTag("stage/fix-review"));
        note = deps.noteService().save(note);
        outputs.put("note", note);
        return new NodeResult(outputs, "then");
    }

    /**
     * Status digest: finding counts by status for one engagement, written as a
     * digest note (delivery beyond the vault is a follow-up).
     */
    NodeResult digest(Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        String engagement = String.valueOf(inputs.getOrDefault("engagement", "")).trim();
        List<Note> engagementNotes = engagement.isEmpty()
            ? Collections.emptyList()
            : deps.noteService().findByTag("engagement/" + engagement);
        Map<String, Integer> counts = AuditFenceParser.countByStatus(engagementNotes);
        String summary = AuditFenceParser.digestMarkdown(engagement, counts);
        Note digest = new Note();
        digest.setTitle("Status digest — " + engagement + " (" + java.time.LocalDate.now() + ")");
        digest.setContent(summary);
        if (!engagement.isEmpty()) {
            digest.getTags().add(deps.tagService().createOrGetTag("engagement/" + engagement));
        }
        digest = deps.noteService().save(digest);
        outputs.put("summary", summary);
        outputs.put("note", digest);
        return new NodeResult(outputs, "then");
    }
}

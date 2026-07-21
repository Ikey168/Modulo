package com.modulo.blueprint.interpreter;

import com.modulo.entity.Note;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses the ```finding fences the Findings Tracker plugin (#358) authors into
 * note bodies, so backend automation (#363) can compile status digests without
 * a schema change. Mirrors the frontend parser's conventions: a `status:`
 * header line inside the fence, defaulting to "open".
 */
public final class AuditFenceParser {

    private static final Pattern FENCE = Pattern.compile("```finding[^\\S\\n]*\\n(.*?)```", Pattern.DOTALL);
    private static final Pattern STATUS = Pattern.compile("^status\\s*:\\s*(\\S+)\\s*$",
        Pattern.MULTILINE | Pattern.CASE_INSENSITIVE);

    /** Canonical status order for digest output. */
    public static final List<String> STATUSES = List.of("open", "acknowledged", "fixed", "verified");

    private AuditFenceParser() {}

    /** Statuses of every finding fence in one note body ("open" when absent). */
    public static List<String> findingStatuses(String body) {
        List<String> out = new ArrayList<>();
        if (body == null || body.isEmpty()) return out;
        Matcher fences = FENCE.matcher(body);
        while (fences.find()) {
            Matcher status = STATUS.matcher(fences.group(1));
            String value = status.find() ? status.group(1).toLowerCase(Locale.ROOT) : "open";
            out.add(STATUSES.contains(value) ? value : "open");
        }
        return out;
    }

    /** Finding counts by status across the given notes, in canonical order. */
    public static Map<String, Integer> countByStatus(Collection<Note> notes) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        STATUSES.forEach(s -> counts.put(s, 0));
        for (Note note : notes) {
            for (String status : findingStatuses(note.getContent())) {
                counts.merge(status, 1, Integer::sum);
            }
        }
        return counts;
    }

    /** Markdown digest body for an engagement's counts. */
    public static String digestMarkdown(String engagement, Map<String, Integer> counts) {
        int total = counts.values().stream().mapToInt(Integer::intValue).sum();
        StringBuilder sb = new StringBuilder();
        sb.append("## Status digest — ").append(engagement).append("\n\n");
        sb.append("Total findings: ").append(total).append("\n\n");
        counts.forEach((status, n) -> sb.append("- ").append(status).append(": ").append(n).append("\n"));
        return sb.toString();
    }
}

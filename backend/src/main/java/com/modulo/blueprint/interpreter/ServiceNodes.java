package com.modulo.blueprint.interpreter;

import com.modulo.note.Note;
import com.modulo.integrations.noesis.NoesisBriefService;
import com.modulo.integrations.openai.OpenAIService;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Built-in nodes backed by external services: {@code action.note.anchor}
 * (blockchain), {@code action.ai.summarize} and {@code action.noesis.brief}.
 * Async actions time out after 30 seconds.
 */
final class ServiceNodes {

    private static final long ACTION_TIMEOUT_SECS = 30;

    private final InterpreterDependencies deps;

    ServiceNodes(InterpreterDependencies deps) {
        this.deps = deps;
    }

    NodeResult anchorNote(Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        Note note = (Note) inputs.get("note");
        String txHash = "";
        if (note != null) {
            try {
                Map<String, Object> result = deps.blockchainService().registerNote(
                    note.getContent() != null ? note.getContent() : "",
                    note.getTitle() != null ? note.getTitle() : "Untitled",
                    "system"
                ).get(ACTION_TIMEOUT_SECS, TimeUnit.SECONDS);
                Object hash = result.get("transactionHash");
                txHash = hash != null ? hash.toString() : "";
            } catch (Exception e) {
                throw new IllegalStateException("BLOCKCHAIN_FAILURE");
            }
        }
        outputs.put("txHash", txHash);
        return new NodeResult(outputs, "then");
    }

    NodeResult summarize(Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        Note note = (Note) inputs.get("note");
        String summary = "";
        if (note != null && note.getContent() != null && !note.getContent().isBlank()) {
            try {
                OpenAIService.SummaryOptions opts = OpenAIService.SummaryOptions.builder().build();
                OpenAIService.SummaryResponse resp = deps.openAIService().generateSummary(note.getContent(), opts);
                summary = resp.getSummary() != null ? resp.getSummary() : "";
            } catch (Exception e) {
                throw new IllegalStateException("AI_FAILURE");
            }
        }
        outputs.put("summary", summary);
        return new NodeResult(outputs, "then");
    }

    /**
     * Daily knowledge brief from a Noesis instance (news, economics, tech, web3,
     * research publications). Degrades to status "unavailable" with empty content
     * when Noesis is unreachable and never blocks the flow.
     */
    NodeResult noesisBrief(Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        String briefDomains = String.valueOf(inputs.getOrDefault("domains", "")).trim();
        String briefSince = String.valueOf(inputs.getOrDefault("since", "")).trim();
        NoesisBriefService.Brief brief = deps.noesisBriefService().fetchBrief(
            briefDomains.isEmpty() ? null : briefDomains,
            briefSince.isEmpty() ? null : briefSince);
        outputs.put("title", brief.title());
        outputs.put("markdown", brief.markdown());
        outputs.put("status", brief.status());
        outputs.put("itemCount", String.valueOf(brief.itemCount()));
        return new NodeResult(outputs, "then");
    }
}

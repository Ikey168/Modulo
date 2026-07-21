package com.modulo.blueprint.interpreter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.BlueprintCapabilityService;
import com.modulo.blueprint.BlueprintEntry;
import com.modulo.blueprint.BlueprintRepository;
import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import com.modulo.plugin.event.NoteEvent;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.event.PluginEventListener;
import com.modulo.service.BlockchainService;
import com.modulo.service.NoteService;
import com.modulo.service.OpenAIService;
import com.modulo.service.TagService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Blueprint Interpreter Tests")
class BlueprintInterpreterServiceTest {

    @InjectMocks private BlueprintInterpreterService interpreter;

    @Mock private BlueprintRepository blueprintRepository;
    @Mock private BlueprintCapabilityService capabilityService;
    @Mock private PluginEventBus eventBus;
    @Mock private NoteService noteService;
    @Mock private TagService tagService;
    @Mock private OpenAIService openAIService;
    @Mock private BlockchainService blockchainService;
    @Mock private JdbcTemplate jdbc;

    // Capture listeners registered against the event bus so we can fire them.
    private final Map<String, PluginEventListener<NoteEvent>> noteListeners = new HashMap<>();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        // Real ObjectMapper so convertValue() works as in production.
        org.springframework.test.util.ReflectionTestUtils.setField(
            interpreter, "objectMapper", new ObjectMapper());
        interpreter.initScheduler();

        // Record note.created / note.updated subscriptions.
        doAnswer(inv -> {
            String type = inv.getArgument(0);
            PluginEventListener<NoteEvent> l = inv.getArgument(1);
            noteListeners.put(type, l);
            return null;
        }).when(eventBus).subscribe(anyString(), any(PluginEventListener.class));

        // noteService.save echoes the note back (assigns an id if missing).
        when(noteService.save(any(Note.class))).thenAnswer(inv -> {
            Note n = inv.getArgument(0);
            if (n.getId() == null) n.setId(42L);
            return n;
        });
        when(tagService.createOrGetTag(anyString())).thenAnswer(inv -> new Tag(inv.getArgument(0)));

        // Grant all capabilities by default so existing tests are not affected.
        when(capabilityService.isGranted(anyLong(), any())).thenReturn(true);
    }

    private BlueprintEntry entry(Map<String, Object> ir) {
        BlueprintEntry e = new BlueprintEntry();
        e.setId(1L);
        e.setName("test-bp");
        e.setIr(ir);
        return e;
    }

    /** trigger.note.saved → action.note.create: firing the trigger runs the action and logs success. */
    @Test
    void triggerNoteSavedRunsAction() {
        Map<String, Object> ir = Map.of(
            "irVersion", 1,
            "nodes", List.of(
                node("t1", "trigger.note.saved", 1, null),
                node("a1", "action.note.create", 1, null)
            ),
            "edges", List.of(
                edge("e1", "exec", "t1", "then", "a1", "in")
            )
        );

        interpreter.registerBlueprint(entry(ir));

        Note note = new Note();
        note.setId(7L);
        note.setTitle("Hello");
        noteListeners.get("note.created").handleEvent(new NoteEvent.NoteCreated(note));

        // The action.note.create node executed (a new note was saved) ...
        verify(noteService, atLeastOnce()).save(any(Note.class));
        // ... and a success execution log was written.
        verify(jdbc, atLeastOnce()).update(anyString(), any(), any(), eq("success"), anyString(), any(), any());
    }

    /** AI summary feeds the tag value of action.tag.add. */
    @Test
    void aiSummaryFeedsTagAdd() {
        when(openAIService.generateSummary(anyString(), any()))
            .thenReturn(OpenAIService.SummaryResponse.builder().summary("short-summary").success(true).build());

        Map<String, Object> ir = Map.of(
            "irVersion", 1,
            "nodes", List.of(
                node("t1", "trigger.note.saved", 1, null),
                node("ai", "action.ai.summarize", 1, null),
                node("tag", "action.tag.add", 1, null)
            ),
            "edges", List.of(
                edge("e1", "exec", "t1", "then", "ai", "in"),
                edge("e2", "data", "t1", "note", "ai", "note"),
                edge("e3", "exec", "ai", "then", "tag", "in"),
                edge("e4", "data", "t1", "note", "tag", "note"),
                edge("e5", "data", "ai", "summary", "tag", "tag")
            )
        );

        interpreter.registerBlueprint(entry(ir));

        Note note = new Note();
        note.setId(7L);
        note.setContent("Some long content to summarize.");
        noteListeners.get("note.created").handleEvent(new NoteEvent.NoteCreated(note));

        // The summary "short-summary" should have become a tag.
        verify(tagService).createOrGetTag("short-summary");
        verify(openAIService).generateSummary(eq("Some long content to summarize."), any());
    }

    /** A cyclic exec graph is bounded by the loop guard and logged as an error, not hung. */
    @Test
    void infiniteLoopIsBounded() {
        // a1 (tag.add) → a2 (tag.add) → a1 ... cycle via exec edges.
        Map<String, Object> ir = Map.of(
            "irVersion", 1,
            "nodes", List.of(
                node("t1", "trigger.note.saved", 1, null),
                node("a1", "action.tag.add", 1, null),
                node("a2", "action.tag.add", 1, null)
            ),
            "edges", List.of(
                edge("e1", "exec", "t1", "then", "a1", "in"),
                edge("e2", "exec", "a1", "then", "a2", "in"),
                edge("e3", "exec", "a2", "then", "a1", "in") // cycle
            )
        );

        interpreter.registerBlueprint(entry(ir));

        Note note = new Note();
        note.setId(7L);
        noteListeners.get("note.created").handleEvent(new NoteEvent.NoteCreated(note));

        // Loop guard fires → an error log is written.
        verify(jdbc, atLeastOnce()).update(anyString(), any(), any(), eq("error"), contains("Loop guard"), any(), any());
        // noteService.save was called many times but bounded (≤ MAX_STEPS).
        verify(noteService, atMost(BlueprintExecutionContext.MAX_STEPS + 1)).save(any(Note.class));
    }

    /** action.code.execute runs through whichever ScriptSandbox engine is configured (#397/#400). */
    @Test
    void codeExecuteRunsThroughConfiguredSandboxEngine() {
        for (com.modulo.blueprint.sandbox.ScriptSandbox engine : List.of(
                new com.modulo.blueprint.sandbox.RhinoScriptSandbox(),
                new com.modulo.blueprint.sandbox.WasmScriptSandbox())) {
            org.springframework.test.util.ReflectionTestUtils.setField(interpreter, "scriptSandbox", engine);

            Map<String, Object> ir = Map.of(
                "irVersion", 1,
                "nodes", List.of(
                    node("t1", "trigger.note.saved", 1, null),
                    node("c1", "action.code.execute", 1,
                        Map.of("code", "function(note) { return note.title.toUpperCase(); }")),
                    node("tag", "action.tag.add", 1, null)
                ),
                "edges", List.of(
                    edge("e1", "exec", "t1", "then", "c1", "in"),
                    edge("e2", "data", "t1", "note", "c1", "note"),
                    edge("e3", "exec", "c1", "then", "tag", "in"),
                    edge("e4", "data", "t1", "note", "tag", "note"),
                    edge("e5", "data", "c1", "output", "tag", "tag")
                )
            );

            interpreter.registerBlueprint(entry(ir));

            Note note = new Note();
            note.setId(7L);
            note.setTitle("hello " + engine.getClass().getSimpleName());
            noteListeners.get("note.created").handleEvent(new NoteEvent.NoteCreated(note));

            // The script's output fed the tag node — uppercased by the engine under test.
            verify(tagService, atLeastOnce())
                .createOrGetTag(("hello " + engine.getClass().getSimpleName()).toUpperCase());
        }
    }

    // --- IR builder helpers (plain maps mirroring the JSON IR) ---

    private static Map<String, Object> node(String id, String type, int version, Map<String, Object> config) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", id);
        m.put("type", type);
        m.put("nodeVersion", version);
        if (config != null) m.put("config", config);
        return m;
    }

    private static Map<String, Object> edge(String id, String kind, String fromNode, String fromPin,
                                            String toNode, String toPin) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", id);
        m.put("kind", kind);
        m.put("fromNode", fromNode);
        m.put("fromPin", fromPin);
        m.put("toNode", toNode);
        m.put("toPin", toPin);
        return m;
    }
}

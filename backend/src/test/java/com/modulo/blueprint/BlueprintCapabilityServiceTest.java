package com.modulo.blueprint;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.interpreter.BlueprintIRGraph;
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
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("BlueprintCapabilityService")
class BlueprintCapabilityServiceTest {

    @InjectMocks
    private BlueprintCapabilityService service;

    @Mock
    private JdbcTemplate jdbc;

    @Mock
    private ObjectMapper objectMapper;

    private BlueprintIRGraph graphWith(String... nodeTypes) {
        BlueprintIRGraph graph = new BlueprintIRGraph();
        List<BlueprintIRGraph.IRNode> nodes = new java.util.ArrayList<>();
        for (int i = 0; i < nodeTypes.length; i++) {
            BlueprintIRGraph.IRNode n = new BlueprintIRGraph.IRNode();
            n.setId("n" + i);
            n.setType(nodeTypes[i]);
            nodes.add(n);
        }
        graph.setNodes(nodes);
        graph.setEdges(List.of());
        return graph;
    }

    @Test
    void derivesCapabilitiesFromActionNodes() {
        BlueprintIRGraph graph = graphWith(
            "trigger.note.saved",
            "action.ai.summarize",
            "action.tag.add",
            "logic.branch"
        );
        Set<String> caps = service.deriveRequiredCapabilities(graph);
        assertThat(caps).containsExactlyInAnyOrder("ai:invoke", "notes:write");
    }

    @Test
    void returnsEmptyForGraphWithNoActionNodes() {
        BlueprintIRGraph graph = graphWith("trigger.note.saved", "logic.branch");
        assertThat(service.deriveRequiredCapabilities(graph)).isEmpty();
    }

    @Test
    void deduplicatesRepeatedCapabilities() {
        // Two nodes that both need notes:write
        BlueprintIRGraph graph = graphWith("action.note.create", "action.tag.add");
        Set<String> caps = service.deriveRequiredCapabilities(graph);
        assertThat(caps).containsExactly("notes:write");
        assertThat(caps).hasSize(1);
    }

    @Test
    void derivesAllFourKnownCapabilities() {
        BlueprintIRGraph graph = graphWith(
            "action.note.create",
            "action.tag.add",
            "action.note.anchor",
            "action.ai.summarize"
        );
        Set<String> caps = service.deriveRequiredCapabilities(graph);
        assertThat(caps).containsExactlyInAnyOrder("notes:write", "blockchain:anchor", "ai:invoke");
    }

    @Test
    void syncPermissionsInsertsNewCapabilities() {
        // Stub the query that fetches existing grants — do nothing (no existing rows).
        doAnswer(inv -> null)
            .when(jdbc).query(anyString(), any(RowCallbackHandler.class), any());

        service.syncPermissions(42L, Set.of("notes:write", "ai:invoke"));

        // The INSERT has 3 Object varargs: pluginId, capability, LocalDateTime
        verify(jdbc, times(2)).update(
            contains("INSERT INTO plugin_permissions"),
            eq(42L), anyString(), any(java.time.LocalDateTime.class)
        );
    }

    @Test
    void isGrantedReturnsTrueWhenGranted() {
        when(jdbc.queryForList(anyString(), eq(Boolean.class), eq(1L), eq("notes:write")))
            .thenReturn(List.of(Boolean.TRUE));
        assertThat(service.isGranted(1L, "notes:write")).isTrue();
    }

    @Test
    void isGrantedReturnsFalseWhenNotGranted() {
        when(jdbc.queryForList(anyString(), eq(Boolean.class), eq(1L), eq("ai:invoke")))
            .thenReturn(List.of(Boolean.FALSE));
        assertThat(service.isGranted(1L, "ai:invoke")).isFalse();
    }

    @Test
    void isGrantedReturnsFalseWhenNoneFound() {
        when(jdbc.queryForList(anyString(), eq(Boolean.class), eq(1L), eq("blockchain:anchor")))
            .thenReturn(List.of());
        assertThat(service.isGranted(1L, "blockchain:anchor")).isFalse();
    }

    @Test
    void isGrantedReturnsTrueWhenCapabilityIsNull() {
        // Trigger / logic nodes have no capability requirement — always allowed.
        assertThat(service.isGranted(1L, null)).isTrue();
        verifyNoInteractions(jdbc);
    }
}

package com.modulo.blueprint.execution;

import static org.junit.jupiter.api.Assertions.*;

import com.modulo.entity.Note;
import com.modulo.observability.ExecutionTraceContext;
import java.util.*;
import org.junit.jupiter.api.Test;

class TracePolicyTest {
  @Test
  void stripsValuesAndRestrictsOwnedReferences() {
    var policy = new TracePolicy("private-customer");
    Note owned = new Note();
    owned.setId(42L);
    owned.setUserId(1L);
    Note foreign = new Note();
    foreign.setId(99L);
    foreign.setUserId(2L);
    var values = Map.of("password", "NEVER_STORE", "mine", owned, "foreign", foreign);
    String denied = policy.summarize(1, values, false);
    assertFalse(denied.contains("42"));
    String allowed = policy.summarize(1, values, true);
    assertTrue(allowed.contains("42"));
    assertFalse(allowed.contains("99"));
    assertFalse(allowed.contains("password"));
    assertFalse(allowed.contains("NEVER_STORE"));
    for (String id : List.of("token=NEVER_STORE", "person@example.com", "private-customer-node")) {
      assertTrue(policy.identifier(id).startsWith("redacted."));
      assertEquals(policy.identifier(id), policy.identifier(id));
    }
    assertEquals("action.note.create", policy.identifier("action.note.create"));
  }

  @Test
  void configuredMatchersAreLiteralAndBounded() {
    var policy = new TracePolicy("(a+)+$");
    assertEquals("a".repeat(128), policy.identifier("a".repeat(128)));
    assertThrows(IllegalArgumentException.class, () -> new TracePolicy("x".repeat(2049)));
  }

  @Test
  void summaryWorkIsBoundedAndMeasured() {
    var policy = new TracePolicy("");
    Map<String, Object> values = new LinkedHashMap<>();
    for (int i = 0; i < 10000; i++) values.put("key" + i, "private payload");
    for (int i = 0; i < 100; i++) policy.summarize(1, values, false);
    long start = System.nanoTime();
    for (int i = 0; i < 10000; i++) assertTrue(policy.summarize(1, values, false).length() < 4096);
    long elapsed = System.nanoTime() - start;
    System.out.println(
        "Trace summary benchmark: "
            + elapsed / 10000
            + " ns/op (256 inspected fields, 10000 input fields)");
    assertTrue(elapsed < java.util.concurrent.TimeUnit.SECONDS.toNanos(10));
  }

  @Test
  void nestedCorrelationRestoresThreadContext() {
    UUID run = UUID.randomUUID(), step = UUID.randomUUID();
    assertNull(ExecutionTraceContext.current());
    try (var outer = ExecutionTraceContext.open(run, step, true)) {
      try (var inner = ExecutionTraceContext.open(UUID.randomUUID(), UUID.randomUUID(), false)) {
        assertFalse(ExecutionTraceContext.current().noteReferencesAllowed());
      }
      assertEquals(step, ExecutionTraceContext.current().stepId());
    }
    assertNull(ExecutionTraceContext.current());
    assertNull(org.slf4j.MDC.get("workflowRunId"));
  }
}

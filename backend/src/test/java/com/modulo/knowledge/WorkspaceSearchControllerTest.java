package com.modulo.knowledge;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkspaceSearchControllerTest {
  @Test void retrievesNestedDocumentTextWithLocalVectors() {
    var knowledge=mock(SemanticKnowledgeService.class); var provider=mock(EmbeddingProvider.class);
    when(knowledge.preferences()).thenReturn(Map.of("provider_mode","LOCAL"));
    when(provider.embed(anyString())).thenReturn(new float[]{1,0});
    var controller=new WorkspaceSearchController(knowledge,provider);
    var hits=controller.search(new WorkspaceSearchController.Query("release",List.of(new WorkspaceSearchController.Document("project:1","Launch","Release evidence accepted"))));
    assertEquals("project:1",hits.get(0).id()); assertTrue(hits.get(0).score()>.5); verify(provider,times(2)).embed(anyString());
  }
  @Test void neverSendsWorkspaceTextToRemoteProvider() {
    var knowledge=mock(SemanticKnowledgeService.class); var provider=mock(EmbeddingProvider.class);
    when(provider.remote()).thenReturn(true);
    var hits=new WorkspaceSearchController(knowledge,provider).search(new WorkspaceSearchController.Query("receipt",List.of(new WorkspaceSearchController.Document("run:1","Deploy","Receipt confirmed"))));
    assertEquals(1,hits.size()); verify(provider,never()).embed(anyString());
  }
  @Test void boundsInputsAndRejectsDuplicateIdentifiers() {
    var controller=new WorkspaceSearchController(mock(SemanticKnowledgeService.class),mock(EmbeddingProvider.class));
    var doc=new WorkspaceSearchController.Document("one","Title","Text");
    assertThrows(ResponseStatusException.class,()->controller.search(new WorkspaceSearchController.Query("q",List.of(doc,doc))));
    assertThrows(ResponseStatusException.class,()->controller.search(new WorkspaceSearchController.Query("q",List.of(new WorkspaceSearchController.Document("one","Title","x".repeat(1_000_001))))));
  }
}

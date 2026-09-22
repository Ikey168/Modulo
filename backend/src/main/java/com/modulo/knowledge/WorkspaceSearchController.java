package com.modulo.knowledge;

import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Request-local retrieval for browser plugin records. No text is persisted or sent to remote providers. */
@RestController
@RequestMapping("/api/knowledge/workspace-search")
@PreAuthorize("isAuthenticated()")
public class WorkspaceSearchController {
  public record Document(String id, String title, String text) {}
  public record Query(String query, List<Document> documents) {}
  public record Hit(String id, double score, String excerpt) {}
  private final SemanticKnowledgeService knowledge;
  private final EmbeddingProvider provider;
  public WorkspaceSearchController(SemanticKnowledgeService knowledge, EmbeddingProvider provider) { this.knowledge=knowledge; this.provider=provider; }
  @PostMapping public List<Hit> search(@RequestBody Query request) {
    if(request.query()==null || request.query().length()>2000 || request.documents()==null || request.documents().size()>200)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use at most 200 documents and a 2000-character query");
    long size=0; Set<String> ids=new HashSet<>();
    for(Document doc:request.documents()) {
      if(doc==null || doc.id()==null || doc.title()==null || doc.text()==null || doc.id().length()>500 || !ids.add(doc.id()))
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid or duplicate document");
      size+=doc.title().length()+doc.text().length();
    }
    if(size>1_000_000) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Search batch exceeds 1 MB of text");
    if(request.query().isBlank()) return List.of();
    boolean local=!provider.remote() && "LOCAL".equals(knowledge.preferences().get("provider_mode"));
    float[] queryVector=null;
    try { if(local) queryVector=provider.embed(request.query()); } catch(RuntimeException unavailable) { /* lexical fallback */ }
    List<Hit> hits=new ArrayList<>();
    for(Document doc:request.documents()) {
      String text=doc.title()+"\n"+doc.text(); double lexical=SemanticKnowledgeService.lexical(request.query(),text), vector=0;
      try { if(queryVector!=null) vector=Math.max(0,SemanticKnowledgeService.cosine(queryVector,provider.embed(text))); } catch(RuntimeException unavailable) { /* lexical fallback */ }
      double score=.45*lexical+.55*vector;
      if(score>0) hits.add(new Hit(doc.id(),score,SemanticKnowledgeService.excerpt(text,request.query())));
    }
    hits.sort(Comparator.comparingDouble(Hit::score).reversed().thenComparing(Hit::id));
    return hits.stream().limit(50).toList();
  }
}

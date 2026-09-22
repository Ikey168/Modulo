package com.modulo.knowledge;

import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/knowledge")
@PreAuthorize("isAuthenticated()")
public class SemanticKnowledgeController {
  private final SemanticKnowledgeService knowledge;
  public SemanticKnowledgeController(SemanticKnowledgeService knowledge){this.knowledge=knowledge;}
  @ExceptionHandler(IllegalArgumentException.class)
  @ResponseStatus(org.springframework.http.HttpStatus.BAD_REQUEST)
  public Map<String,String> invalid(IllegalArgumentException failure){return Map.of("error",failure.getMessage());}
  @ExceptionHandler(IllegalStateException.class)
  @ResponseStatus(org.springframework.http.HttpStatus.CONFLICT)
  public Map<String,String> unavailable(IllegalStateException failure){return Map.of("error",failure.getMessage());}
  @ExceptionHandler(java.util.NoSuchElementException.class)
  @ResponseStatus(org.springframework.http.HttpStatus.NOT_FOUND)
  public Map<String,String> missing(){return Map.of("error","Knowledge resource not found");}
  @PostMapping("/embeddings/backfill") public Object backfill(){return knowledge.backfill();}
  @PostMapping("/embeddings/notes/{id}") public Object refresh(@PathVariable long id){return Map.of("updated",knowledge.refresh(id));}
  @GetMapping("/search") public Object search(@RequestParam String q,@RequestParam(defaultValue="20") int limit){return knowledge.search(q,limit);}
  @GetMapping("/notes/{id}/suggestions") public Object suggestions(@PathVariable long id,@RequestParam(defaultValue="8") int limit){return knowledge.suggestions(id,limit);}
  public record Decision(String decision){}
  @PostMapping("/suggestions/{id}/decision") public Object decide(@PathVariable UUID id,@RequestBody Decision body){knowledge.decide(id,body.decision());return Map.of("status",body.decision().toUpperCase());}
  public record Ask(String question,Integer maxCitations){}
  @PostMapping("/ask") public Object ask(@RequestBody Ask body){return knowledge.ask(body.question(),body.maxCitations()==null?4:body.maxCitations());}
  @GetMapping("/preferences") public Object preferences(){return knowledge.preferences();}
  public record Preferences(String providerMode,boolean remoteConsent,int monthlyBudgetCents){}
  @PutMapping("/preferences") public Object preferences(@RequestBody Preferences body){return knowledge.preferences(body.providerMode(),body.remoteConsent(),body.monthlyBudgetCents());}
}

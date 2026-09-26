package com.modulo.knowledge;

import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Drains the durable PostgreSQL queue populated in the note transaction. */
@Component
public class KnowledgeEmbeddingEventListener {
  private final SemanticKnowledgeService knowledge;
  public KnowledgeEmbeddingEventListener(SemanticKnowledgeService knowledge){this.knowledge=knowledge;}
  @Scheduled(fixedDelayString="${modulo.knowledge.index-interval-ms:2000}",initialDelayString="${modulo.knowledge.index-initial-delay-ms:10000}")
  public void drain(){
    try{for(int i=0;i<25&&knowledge.processNextQueuedNote();i++){ /* bounded work per tick */ }}
    catch(RuntimeException failure){LoggerFactory.getLogger(getClass()).warn("Knowledge indexing deferred: {}",failure.getClass().getSimpleName());}
  }
}

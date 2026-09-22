package com.modulo.knowledge;

import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import com.modulo.security.AuthenticatedUserService;
import com.modulo.service.NoteLinkService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-scoped indexing, hybrid retrieval, suggestions and cited extractive QA (#448-450). */
@Service
public class SemanticKnowledgeService {
  private static final int MAX_QUERY_CHARACTERS = 2000;
  public record SearchHit(long noteId, String title, double score, double lexicalScore,
      double vectorScore, String provider, String model, String version, String excerpt) {}
  public record BackfillResult(int scanned, int embedded, int unchanged, int failed,
      String provider, String model) {}
  public record Suggestion(UUID id, long sourceNoteId, long targetNoteId, double score,
      String explanation, String provider, String model, String status) {}
  public record Citation(long noteId, String title, String excerpt) {}
  public record AnswerSpan(int start,int end,long noteId,String excerptDigest) {}
  public record Answer(String answer, List<Citation> citations, boolean answered,
      String providerMode, String notice,List<AnswerSpan> spans) {
    public Answer(String answer,List<Citation> citations,boolean answered,String providerMode,String notice){
      this(answer,citations,answered,providerMode,notice,answerSpans(answer,citations));
    }
  }
  static List<AnswerSpan> answerSpans(String answer,List<Citation> citations){
    List<AnswerSpan> spans=new ArrayList<>();int cursor=0;
    for(Citation citation:citations){int start=answer.indexOf(citation.excerpt(),cursor);if(start>=0){cursor=start+citation.excerpt().length();spans.add(new AnswerSpan(start,cursor,citation.noteId(),digest(citation.excerpt())));}}
    return List.copyOf(spans);
  }

  private final NoteRepository notes;
  private final AuthenticatedUserService users;
  private final JdbcTemplate jdbc;
  private final NoteLinkService links;
  private final EmbeddingProvider provider;

  public SemanticKnowledgeService(NoteRepository notes, AuthenticatedUserService users,
      JdbcTemplate jdbc, NoteLinkService links, EmbeddingProvider provider) {
    this.notes = notes; this.users = users; this.jdbc = jdbc; this.links = links; this.provider = provider;
  }

  @Transactional
  public BackfillResult backfill() {
    long owner = users.requireUserId();
    if (!localEnabled(owner)) return new BackfillResult(0,0,0,0,provider.id(),provider.model());
    int scanned = 0, embedded = 0, unchanged = 0, failed = 0;
    for (Note note : notes.findAll()) {
      if (!Objects.equals(note.getUserId(),owner)) continue;
      scanned++;
      String text = text(note), digest = digest(text);
      List<Map<String,Object>> current = jdbc.queryForList(
          "SELECT content_digest,provider,model,state FROM application.note_embeddings WHERE owner_id=? AND note_id=? AND provider=? AND model=?",
          owner, note.getId(),provider.id(),provider.model());
      if (!current.isEmpty() && digest.equals(current.get(0).get("content_digest"))
          && provider.id().equals(current.get(0).get("provider"))
          && provider.model().equals(current.get(0).get("model")) && "READY".equals(current.get(0).get("state"))) {
        unchanged++; continue;
      }
      if (embedded+failed>=100) break;
      try { store(owner, note.getId(), digest, provider.embed(text)); embedded++; }
      catch (RuntimeException failure) {
        failed++;
        failed(owner,note.getId(),digest);
      }
    }
    return new BackfillResult(scanned, embedded, unchanged, failed, provider.id(), provider.model());
  }

  /** Explicit refresh never drops the final edit; automatic saves use the durable queue. */
  @Transactional
  public boolean refresh(long noteId) {
    long owner = users.requireUserId();
    Note note = notes.findById(noteId).orElseThrow();
    if (!Objects.equals(note.getUserId(),owner)) throw new NoSuchElementException("Note not found");
    if (!localEnabled(owner)) return false;
    String text = text(note), digest = digest(text);
    List<Map<String,Object>> current = jdbc.queryForList(
        "SELECT content_digest,provider,model,state FROM application.note_embeddings WHERE owner_id=? AND note_id=? AND provider=? AND model=?", owner,noteId,provider.id(),provider.model());
    if (!current.isEmpty() && digest.equals(current.get(0).get("content_digest"))
        && "READY".equals(current.get(0).get("state"))) return false;
    store(owner, noteId, digest, provider.embed(text)); return true;
  }

  /** Same refresh path for note-event workers where the request SecurityContext is intentionally absent. */
  @Transactional
  public boolean refreshOwned(long owner, Note note) {
    if (note == null || note.getId() == null || note.getUserId() == null || note.getUserId() != owner) return false;
    if (!localEnabled(owner)) return false;
    String body = text(note), contentDigest = digest(body);
    List<Map<String,Object>> current = jdbc.queryForList(
        "SELECT content_digest,provider,model,state FROM application.note_embeddings WHERE owner_id=? AND note_id=? AND provider=? AND model=?", owner,note.getId(),provider.id(),provider.model());
    if (!current.isEmpty() && contentDigest.equals(current.get(0).get("content_digest"))
        && "READY".equals(current.get(0).get("state"))) return false;
    store(owner,note.getId(),contentDigest,provider.embed(body)); return true;
  }

  @Transactional public void deleteOwned(long owner,long noteId){jdbc.update("DELETE FROM application.note_embeddings WHERE owner_id=? AND note_id=?",owner,noteId);}

  private boolean localEnabled(long owner){
    if(provider.remote()) return false; // No provider may transmit text without a configured consent/cost boundary.
    List<Map<String,Object>> rows=jdbc.queryForList("SELECT provider_mode FROM application.knowledge_preferences WHERE owner_id=?",owner);
    return rows.isEmpty() || "LOCAL".equals(rows.get(0).get("provider_mode"));
  }

  @Transactional
  public boolean processNextQueuedNote(){
    List<Map<String,Object>> jobs=jdbc.queryForList("SELECT note_id,owner_id FROM application.knowledge_index_queue WHERE available_at<=now() ORDER BY available_at,note_id LIMIT 1 FOR UPDATE SKIP LOCKED");
    if(jobs.isEmpty())return false;
    long noteId=((Number)jobs.get(0).get("note_id")).longValue(),owner=((Number)jobs.get(0).get("owner_id")).longValue();
    List<Map<String,Object>> rows=jdbc.queryForList("SELECT title,content,markdown_content FROM application.notes WHERE note_id=? AND user_id=?",noteId,owner);
    if(!rows.isEmpty()&&localEnabled(owner)){
      Map<String,Object> row=rows.get(0);
      String body=Objects.toString(row.get("title"),"")+"\n"+Objects.toString(row.get("markdown_content")!=null?row.get("markdown_content"):row.get("content"),"");
      List<Map<String,Object>> current=jdbc.queryForList("SELECT content_digest,state FROM application.note_embeddings WHERE owner_id=? AND note_id=? AND provider=? AND model=?",owner,noteId,provider.id(),provider.model());
      if(!current.isEmpty()&&"READY".equals(current.get(0).get("state"))&&digest(body).equals(current.get(0).get("content_digest"))){jdbc.update("DELETE FROM application.knowledge_index_queue WHERE note_id=?",noteId);return true;}
      float[] vector;
      try{vector=provider.embed(body);}
      catch(RuntimeException failure){
        failed(owner,noteId,digest(body));
        jdbc.update("UPDATE application.knowledge_index_queue SET attempts=attempts+1,available_at=now()+interval '1 minute' WHERE note_id=?",noteId);
        return true;
      }
      store(owner,noteId,digest(body),vector);
    }
    jdbc.update("DELETE FROM application.knowledge_index_queue WHERE note_id=?",noteId);
    return true;
  }

  private void failed(long owner,long noteId,String digest){
    jdbc.update("INSERT INTO application.note_embeddings(owner_id,note_id,provider,model,dimensions,content_digest,state,error,updated_at) VALUES(?,?,?,?,?,?,'FAILED','Embedding provider failed',now()) ON CONFLICT(owner_id,note_id,provider,model) DO UPDATE SET content_digest=excluded.content_digest,state='FAILED',error=excluded.error,updated_at=now()",owner,noteId,provider.id(),provider.model(),provider.dimensions(),digest);
  }

  public Map<String,Object> preferences(){long owner=users.requireUserId();List<Map<String,Object>> rows=jdbc.queryForList("SELECT provider_mode,remote_consent,monthly_budget_cents,updated_at FROM application.knowledge_preferences WHERE owner_id=?",owner);return rows.isEmpty()?Map.of("provider_mode","LOCAL","remote_consent",false,"monthly_budget_cents",0):rows.get(0);}
  @Transactional public Map<String,Object> preferences(String mode,boolean remoteConsent,int budget){long owner=users.requireUserId();String normalized=Objects.toString(mode,"LOCAL").toUpperCase(Locale.ROOT);if(!Set.of("LOCAL","REMOTE","OFF").contains(normalized))throw new IllegalArgumentException("provider_mode must be LOCAL, REMOTE or OFF");if("REMOTE".equals(normalized)){if(!remoteConsent)throw new IllegalArgumentException("Remote provider use requires explicit consent");throw new IllegalStateException("No remote embedding/QA provider is configured; note text will not be sent externally");}jdbc.update("INSERT INTO application.knowledge_preferences(owner_id,provider_mode,remote_consent,monthly_budget_cents,updated_at) VALUES(?,?,?,?,now()) ON CONFLICT(owner_id) DO UPDATE SET provider_mode=excluded.provider_mode,remote_consent=excluded.remote_consent,monthly_budget_cents=excluded.monthly_budget_cents,updated_at=now()",owner,normalized,false,Math.max(0,budget));return preferences();}

  public List<SearchHit> search(String query, int limit) {
    long owner = users.requireUserId();
    String q = query == null ? "" : query.trim();
    if(q.length()>MAX_QUERY_CHARACTERS)throw new IllegalArgumentException("Knowledge query must be at most 2000 characters");
    if (q.isEmpty()) return List.of();
    float[] qv = null;
    try { if(localEnabled(owner)) qv = provider.embed(q); } catch (RuntimeException ignored) { /* lexical fallback */ }
    Map<Long,Map<String,Object>> indexed=new HashMap<>();
    if(qv!=null) {
      try {
        for(Map<String,Object> row:jdbc.queryForList("SELECT note_id,content_digest,embedding::text AS vector FROM application.note_embeddings WHERE owner_id=? AND provider=? AND model=? AND dimensions=? AND state='READY'",owner,provider.id(),provider.model(),provider.dimensions()))
          indexed.put(((Number)row.get("note_id")).longValue(),row);
      } catch(RuntimeException unavailable) { qv=null; }
    }
    List<SearchHit> hits = new ArrayList<>();
    for (Note note : notes.findAll()) {
      if (note.getUserId() == null || note.getUserId() != owner) continue;
      String body = text(note); double lexical = lexical(q, body);
      double vector = 0;
      if (qv != null) {
        Map<String,Object> cached=indexed.get(note.getId());
        if(cached!=null && digest(body).equals(cached.get("content_digest")))
          try { vector = cosine(qv, parseVector(cached.get("vector").toString())); } catch (RuntimeException ignored) { vector = 0; }
      }
      double score = 0.45 * lexical + 0.55 * Math.max(0, vector);
      if (score > 0) hits.add(new SearchHit(note.getId(), note.getTitle(), score, lexical, vector,
          provider.id(), provider.model(), digest(body), excerpt(body, q)));
    }
    hits.sort(Comparator.comparingDouble(SearchHit::score).reversed().thenComparingLong(SearchHit::noteId));
    return hits.subList(0, Math.min(Math.max(1, Math.min(limit, 50)), hits.size()));
  }

  @Transactional
  public List<Suggestion> suggestions(long sourceNoteId, int limit) {
    long owner = users.requireUserId();
    Note source = notes.findById(sourceNoteId).orElseThrow();
    if(!Objects.equals(source.getUserId(),owner)) throw new NoSuchElementException("Note not found");
    // Notes are not constrained by the interactive query limit. Bound the
    // internally generated query so long notes can still request suggestions.
    String query = text(source);
    if (query.length() > MAX_QUERY_CHARACTERS) {
      int end = MAX_QUERY_CHARACTERS;
      if (Character.isHighSurrogate(query.charAt(end - 1))) end--;
      query = query.substring(0, end);
    }
    int boundedLimit = Math.max(1, Math.min(limit, 20));
    List<SearchHit> candidates = search(query, Math.min(50, Math.max(boundedLimit * 3, 10)));
    List<Suggestion> result = new ArrayList<>();
    for (SearchHit hit : candidates) {
      if (hit.noteId() == sourceNoteId || hit.score() < .28 || links.linkExists(sourceNoteId, hit.noteId())) continue;
      List<Map<String,Object>> decisions=jdbc.queryForList("SELECT status FROM application.suggested_note_links WHERE owner_id=? AND source_note_id=? AND target_note_id=?",owner,sourceNoteId,hit.noteId());
      if(!decisions.isEmpty() && !"PENDING".equals(decisions.get(0).get("status"))) continue;
      UUID id = UUID.nameUUIDFromBytes((owner+":"+sourceNoteId+":"+hit.noteId()).getBytes(StandardCharsets.UTF_8));
      String explanation = "Hybrid similarity " + String.format(Locale.ROOT, "%.3f", hit.score())
          + " (lexical " + String.format(Locale.ROOT,"%.3f",hit.lexicalScore()) + ", semantic "
          + String.format(Locale.ROOT,"%.3f",hit.vectorScore()) + ")";
      jdbc.update("INSERT INTO application.suggested_note_links(id,owner_id,source_note_id,target_note_id,score,explanation,provider,model,status) VALUES(?,?,?,?,?,?,?,?,'PENDING') ON CONFLICT(owner_id,source_note_id,target_note_id) DO UPDATE SET score=excluded.score,explanation=excluded.explanation,provider=excluded.provider,model=excluded.model",
          id,owner,sourceNoteId,hit.noteId(),hit.score(),explanation,provider.id(),provider.model());
      result.add(new Suggestion(id,sourceNoteId,hit.noteId(),hit.score(),explanation,provider.id(),provider.model(),"PENDING"));
      if (result.size() >= boundedLimit) break;
    }
    return result;
  }

  @Transactional
  public void decide(UUID id, String decision) {
    long owner = users.requireUserId();
    String normalized = decision == null ? "" : decision.toUpperCase(Locale.ROOT);
    if (!Set.of("ACCEPTED","REJECTED","DISMISSED").contains(normalized)) throw new IllegalArgumentException("Invalid decision");
    List<Map<String,Object>> rows = jdbc.queryForList("SELECT source_note_id,target_note_id,status FROM application.suggested_note_links WHERE id=? AND owner_id=? FOR UPDATE",id,owner);
    if (rows.isEmpty()) throw new NoSuchElementException("Suggestion not found");
    if(!"PENDING".equals(rows.get(0).get("status"))) return;
    if ("ACCEPTED".equals(normalized)) links.createLink(((Number)rows.get(0).get("source_note_id")).longValue(),((Number)rows.get(0).get("target_note_id")).longValue(),"semantic-suggestion");
    jdbc.update("UPDATE application.suggested_note_links SET status=?,decided_at=now() WHERE id=? AND owner_id=?",normalized,id,owner);
  }

  public Answer ask(String question, int maxCitations) {
    long owner=users.requireUserId();
    if(!localEnabled(owner)) return new Answer("Ask Modulo is disabled. Your notes and lexical search remain available.",List.of(),false,"OFF","No note text was sent to a provider.");
    List<SearchHit> hits = search(question, Math.max(1, Math.min(maxCitations,5)));
    if (hits.isEmpty() || hits.get(0).score() < .12) return new Answer(
        "I couldn't find enough support in your notes to answer that.", List.of(), false, "LOCAL",
        "Local mode: note text stays on this device/server process.");
    List<Citation> citations = new ArrayList<>();
    List<String> sentences = new ArrayList<>();
    for (SearchHit hit : hits) {
      String sentence = bestSentence(hit.excerpt(), question);
      if (sentence.isBlank()) continue;
      sentences.add(sentence + " [" + (citations.size()+1) + "]");
      citations.add(new Citation(hit.noteId(), hit.title(), sentence));
    }
    if (citations.isEmpty()) return new Answer("I couldn't find enough support in your notes to answer that.",List.of(),false,"LOCAL","No unsupported answer was generated.");
    return new Answer(String.join(" ", sentences), citations, true, "LOCAL",
        "Extractive answer: note content is treated as untrusted data; instructions inside notes are never executed.");
  }

  private void store(long owner,long noteId,String digest,float[] vector) {
    if(vector==null||vector.length!=provider.dimensions())throw new IllegalArgumentException("Embedding dimensions do not match the model");
    for(float value:vector)if(!Float.isFinite(value))throw new IllegalArgumentException("Embedding must be finite");
    String literal = vectorLiteral(vector);
    jdbc.update("INSERT INTO application.note_embeddings(owner_id,note_id,provider,model,dimensions,content_digest,embedding,state,error,embedded_at,updated_at) VALUES(?,?,?,?,?,?,CAST(? AS vector),'READY',NULL,now(),now()) ON CONFLICT(owner_id,note_id,provider,model) DO UPDATE SET dimensions=excluded.dimensions,content_digest=excluded.content_digest,embedding=excluded.embedding,state='READY',error=NULL,embedded_at=now(),updated_at=now()",
        owner,noteId,provider.id(),provider.model(),provider.dimensions(),digest,literal);
  }
  private static String text(Note note){return (Objects.toString(note.getTitle(),"")+"\n"+Objects.toString(note.getMarkdownContent()!=null?note.getMarkdownContent():note.getContent(),""));}
  static String digest(String text){try{byte[] d=MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));return java.util.HexFormat.of().formatHex(d);}catch(Exception e){throw new IllegalStateException(e);}}
  static String vectorLiteral(float[] v){StringJoiner j=new StringJoiner(",","[","]");for(float x:v)j.add(Float.toString(x));return j.toString();}
  static float[] parseVector(String value){String[] parts=value.substring(1,value.length()-1).split(",");float[] vector=new float[parts.length];for(int i=0;i<parts.length;i++)vector[i]=Float.parseFloat(parts[i]);return vector;}
  static double cosine(float[] a,float[] b){double dot=0,aa=0,bb=0;for(int i=0;i<Math.min(a.length,b.length);i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa==0||bb==0?0:dot/Math.sqrt(aa*bb);}
  static double lexical(String q,String body){Set<String> terms=new HashSet<>(Arrays.asList(q.toLowerCase(Locale.ROOT).split("\\W+")));terms.remove("");if(terms.isEmpty())return 0;String lower=body.toLowerCase(Locale.ROOT);long match=terms.stream().filter(lower::contains).count();return (double)match/terms.size();}
  static String excerpt(String body,String q){String[] s=body.replace('\n',' ').split("(?<=[.!?])\\s+");if(s.length==0)return body.substring(0,Math.min(320,body.length()));return Arrays.stream(s).max(Comparator.comparingDouble(x->lexical(q,x))).orElse("").substring(0,Math.min(320,Arrays.stream(s).max(Comparator.comparingDouble(x->lexical(q,x))).orElse("").length()));}
  static String bestSentence(String excerpt,String q){String[] sentences=excerpt.replace('\n',' ').split("(?<=[.!?])\\s+");return Arrays.stream(sentences).map(String::trim).filter(s->!s.isBlank()).filter(s->!instructionLike(s)).max(Comparator.comparingDouble(s->lexical(q,s))).map(s->s.substring(0,Math.min(320,s.length()))).orElse("");}
  static boolean instructionLike(String sentence){String lower=sentence.toLowerCase(Locale.ROOT);return (lower.contains("system prompt")||lower.contains("developer message")||lower.contains("hidden instruction")||lower.contains("tool call")||lower.contains("call a tool")||lower.contains("execute tool")||lower.contains("reveal secret"))||((lower.contains("ignore")||lower.contains("disregard")||lower.contains("override"))&&lower.contains("instruction"));}
  static String compact(String value){if(value==null)return "Embedding failed";return value.length()>500?value.substring(0,500):value;}
}

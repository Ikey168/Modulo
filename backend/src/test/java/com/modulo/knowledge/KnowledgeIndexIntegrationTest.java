package com.modulo.knowledge;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.modulo.entity.Note;
import com.modulo.migration.SchemaMigrationTool;
import com.modulo.repository.NoteRepository;
import com.modulo.security.AuthenticatedUserService;
import com.modulo.service.NoteLinkService;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class KnowledgeIndexIntegrationTest {
  @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
  JdbcTemplate jdbc;
  NoteRepository notes;
  AuthenticatedUserService users;
  NoteLinkService links;
  SemanticKnowledgeService service;
  EmbeddingProvider provider;
  @BeforeAll static void migrate(){SchemaMigrationTool.flyway(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword()).migrate();}
  @BeforeEach void setup(){
    jdbc=new JdbcTemplate(new DriverManagerDataSource(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword()));
    jdbc.execute("TRUNCATE application.notes CASCADE");jdbc.execute("TRUNCATE application.knowledge_preferences");
    notes=mock(NoteRepository.class);users=mock(AuthenticatedUserService.class);links=mock(NoteLinkService.class);
    when(users.requireUserId()).thenReturn(7L);provider=mock(EmbeddingProvider.class,org.mockito.AdditionalAnswers.delegatesTo(new LocalHashEmbeddingProvider()));
    service=new SemanticKnowledgeService(notes,users,jdbc,links,provider);
  }
  Note note(long id,long owner,String content){
    jdbc.update("INSERT INTO application.notes(note_id,user_id,title,content,version) VALUES(?,?,'Travel',?,0)",id,owner,content);
    Note note=new Note("Travel",content);note.setId(id);note.setUserId(owner);return note;
  }
  void due(){jdbc.update("UPDATE application.knowledge_index_queue SET available_at=now()-interval '1 second'");}
  @Test void queueSurvivesWorkerReplacementAndIndexesFinalCommittedEdit(){
    note(1,7,"Berlin old draft");jdbc.update("UPDATE application.notes SET content='Berlin final edit' WHERE note_id=1");
    assertThat(jdbc.queryForObject("SELECT count(*) FROM application.knowledge_index_queue",Integer.class)).isEqualTo(1);
    due();var restarted=new SemanticKnowledgeService(notes,users,jdbc,links,provider);
    assertThat(restarted.processNextQueuedNote()).isTrue();
    assertThat(jdbc.queryForObject("SELECT content_digest FROM application.note_embeddings",String.class)).isEqualTo(SemanticKnowledgeService.digest("Travel\nBerlin final edit"));
    assertThat(restarted.processNextQueuedNote()).isFalse();
    jdbc.update("DELETE FROM application.notes WHERE note_id=1");
    assertThat(jdbc.queryForObject("SELECT count(*) FROM application.note_embeddings",Integer.class)).isZero();
  }
  @Test void retrievalUsesStoredVectorsAndCannotExposeForeignOrSharedSources(){
    Note mine=note(1,7,"Berlin is in Germany."),foreign=note(2,8,"Berlin private shared-note content.");
    when(notes.findAll()).thenReturn(List.of(mine,foreign));due();while(service.processNextQueuedNote()){}
    clearInvocations(provider);
    assertThat(service.search("Berlin",20)).extracting(SemanticKnowledgeService.SearchHit::noteId).containsExactly(1L);
    verify(provider).embed("Berlin");verify(provider,never()).embed("Travel\nBerlin is in Germany.");
    assertThat(service.ask("Berlin",5).citations()).extracting(SemanticKnowledgeService.Citation::noteId).containsExactly(1L);
    when(notes.findById(2L)).thenReturn(Optional.of(foreign));
    assertThatThrownBy(()->service.suggestions(2,5)).isInstanceOf(NoSuchElementException.class);
    assertThatThrownBy(()->service.refresh(2)).isInstanceOf(NoSuchElementException.class);
  }
  @Test void failedEmbeddingRetriesAndModelGenerationsArePreserved(){
    Note mine=note(1,7,"Berlin");when(notes.findAll()).thenReturn(List.of(mine));
    doThrow(new IllegalStateException("provider unavailable")).when(provider).embed(anyString());
    assertThat(service.backfill().failed()).isEqualTo(1);
    doAnswer(call->new LocalHashEmbeddingProvider().embed(call.getArgument(0))).when(provider).embed(anyString());
    assertThat(service.backfill().embedded()).isEqualTo(1);
    assertThat(service.backfill().unchanged()).isEqualTo(1);
    doReturn("hashing-v2").when(provider).model();
    assertThat(service.backfill().embedded()).isEqualTo(1);
    assertThat(jdbc.queryForList("SELECT model FROM application.note_embeddings")).hasSize(2);
  }
  @Test void offAndUnexpectedRemoteProviderNeverReceiveText(){
    Note mine=note(1,7,"Berlin");when(notes.findAll()).thenReturn(List.of(mine));
    service.preferences("OFF",false,0);clearInvocations(provider);
    assertThat(service.search("Berlin",20)).hasSize(1);assertThat(service.ask("Berlin",5).answered()).isFalse();
    service.backfill();due();service.processNextQueuedNote();verify(provider,never()).embed(anyString());
    service.preferences("LOCAL",false,0);doReturn(true).when(provider).remote();
    service.search("Berlin",20);service.backfill();verify(provider,never()).embed(anyString());
  }
  @Test void staleContentFallsBackUntilReindexedAndDismissedSuggestionsStayDismissed(){
    Note first=note(1,7,"Berlin travel"),second=note(2,7,"Berlin travel tips");when(notes.findAll()).thenReturn(List.of(first,second));when(notes.findById(1L)).thenReturn(Optional.of(first));
    service.backfill();List<SemanticKnowledgeService.Suggestion> suggestions=service.suggestions(1,5);assertThat(suggestions).hasSize(1);
    service.decide(suggestions.get(0).id(),"DISMISSED");assertThat(service.suggestions(1,5)).isEmpty();verify(links,never()).createLink(anyLong(),anyLong(),anyString());
    second.setContent("Berlin changed");
    second.setMarkdownContent("Berlin changed");
    assertThat(service.search("Berlin",20).stream().filter(hit->hit.noteId()==2).findFirst().orElseThrow().vectorScore()).isZero();
  }

  @Test void longNotesProduceSuggestionsWithoutRelaxingInteractiveQueryLimits(){
    Note source=note(1,7,"Berlin travel tips. ".repeat(300));
    Note target=note(2,7,"Berlin travel tips.");
    when(notes.findAll()).thenReturn(List.of(source,target));
    when(notes.findById(1L)).thenReturn(Optional.of(source));
    service.backfill();

    assertThat(service.suggestions(1,Integer.MAX_VALUE))
        .extracting(SemanticKnowledgeService.Suggestion::targetNoteId).containsExactly(2L);
    verify(links,never()).createLink(anyLong(),anyLong(),anyString());
    assertThatThrownBy(()->service.search("Berlin ".repeat(300),20))
        .isInstanceOf(IllegalArgumentException.class);
  }
}

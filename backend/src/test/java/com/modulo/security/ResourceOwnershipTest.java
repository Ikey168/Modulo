package com.modulo.security;

import com.modulo.entity.*;
import com.modulo.entity.Tag;
import com.modulo.repository.*;
import com.modulo.repository.jpa.OptimizedNoteRepository;
import com.modulo.service.*;
import com.modulo.plugin.event.PluginEventBus;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import javax.persistence.EntityManagerFactory;
import javax.sql.DataSource;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Testcontainers
class ResourceOwnershipTest {
    @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
    static AnnotationConfigApplicationContext context;
    static final ThreadLocal<Long> owner = ThreadLocal.withInitial(() -> 1L);
    JdbcTemplate jdbc;
    NoteRepository notes; TagService tags; TaskService tasks; NoteLinkService links;
    TransactionTemplate transaction;

    @Configuration
    @Import(TenantQueryExtension.class)
    @org.springframework.data.jpa.repository.config.EnableJpaRepositories(
        basePackages = "com.modulo.repository",
        excludeFilters = @ComponentScan.Filter(type = FilterType.REGEX,
            pattern = "com\\.modulo\\.repository\\.(?!(NoteRepository|TagRepository|TaskRepository|NoteLinkRepository)$|jpa\\.OptimizedNoteRepository$).*"))
    @org.springframework.cache.annotation.EnableCaching
    static class Config {
        @Bean DataSource dataSource() { return new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword()); }
        @Bean LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource dataSource) {
            com.modulo.migration.SchemaMigrationTool.flyway(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword()).migrate();
            var emf = new LocalContainerEntityManagerFactoryBean(); emf.setDataSource(dataSource); emf.setPackagesToScan("com.modulo");
            emf.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            emf.setJpaPropertyMap(Map.of("hibernate.dialect", "org.hibernate.dialect.PostgreSQL10Dialect", "hibernate.hbm2ddl.auto", "none",
                "hibernate.physical_naming_strategy", "org.springframework.boot.orm.jpa.hibernate.SpringPhysicalNamingStrategy"));
            return emf;
        }
        @Bean PlatformTransactionManager transactionManager(EntityManagerFactory emf) { return new JpaTransactionManager(emf); }
        @Bean AuthenticatedUserService authenticatedUserService() {
            var service = mock(AuthenticatedUserService.class);
            when(service.requireUserId()).thenAnswer(call -> owner.get()); when(service.actor()).thenAnswer(call -> owner.get().toString());
            when(service.requireOwner(any())).thenAnswer(call -> {
                Long requested = call.getArgument(0);
                if (requested != null && !requested.equals(owner.get())) throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
                return owner.get();
            }); return service;
        }
        @Bean PluginEventBus events() { return mock(PluginEventBus.class); }
        @Bean TagService tagService(TagRepository repository) { return new TagService(repository); }
        @Bean org.springframework.cache.CacheManager cacheManager() { return new org.springframework.cache.concurrent.ConcurrentMapCacheManager(); }
        @Bean OptimizedNoteService optimizedService() { return new OptimizedNoteService(); }
        @Bean TaskService taskService() { return new TaskService(); }
        @Bean NoteLinkService linkService(NoteLinkRepository links, NoteRepository notes, PluginEventBus events) { return new NoteLinkService(links, notes, events); }
    }
    @BeforeAll static void start() { context = new AnnotationConfigApplicationContext(Config.class); }
    @AfterAll static void stop() { if (context != null) context.close(); }
    @BeforeEach void setup() {
        owner.set(1L); jdbc = new JdbcTemplate(context.getBean(DataSource.class));
        jdbc.execute("TRUNCATE application.notes, application.tags, tasks RESTART IDENTITY CASCADE");
        jdbc.update("INSERT INTO application.notes(note_id,user_id,title,content,version) VALUES (101,1,'Alice','search me',0),(202,2,'Bob','search me',0),(303,NULL,'Legacy','quarantined',0)");
        notes = context.getBean(NoteRepository.class); tags = context.getBean(TagService.class); tasks = context.getBean(TaskService.class); links = context.getBean(NoteLinkService.class);
        transaction = new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
    }
    @AfterEach void clear() { owner.remove(); }
    @Test void noteListsGetsAndSearchesCannotCrossOwners() {
        assertEquals(List.of(101L), notes.findAllWithTags().stream().map(Note::getId).toList());
        assertTrue(notes.findById(202L).isEmpty()); assertFalse(notes.existsById(202L)); assertTrue(notes.findByIdWithTags(303L).isEmpty());
        assertEquals(1, notes.findByTitleOrContentContainingIgnoreCase("search").size());
        assertEquals(List.of(101L), notes.findAllById(List.of(101L, 202L)).stream().map(Note::getId).toList());
        owner.set(2L); assertTrue(notes.findById(101L).isEmpty()); assertEquals(202L, notes.findAllWithTags().get(0).getId());
    }
    @Test void optimizedQueriesScopeBothRowsAndCounts() {
        var optimized = context.getBean(OptimizedNoteRepository.class);
        var page = optimized.searchNotesOptimized("search", org.springframework.data.domain.PageRequest.of(0, 10));
        assertEquals(1, page.getTotalElements()); assertEquals(101L, page.getContent().get(0).getId());
        assertTrue(optimized.findByIdOptimized(202L).isEmpty());
        assertEquals(0, optimized.countByUserId(2L));
    }
    @Test void cachedNotesArePartitionedByAuthenticatedOwner() {
        var service = context.getBean(OptimizedNoteService.class);
        assertEquals(101L, service.findById(101L).orElseThrow().getId());
        owner.set(2L); assertTrue(service.findById(101L).isEmpty());
        owner.set(1L); assertEquals(101L, service.findById(101L).orElseThrow().getId());
    }
    @Test void tagNamesAreIndependentAndCannotBeDeletedByAnotherOwner() {
        UUID alice = transaction.execute(status -> tags.createOrGetTag("private").getId());
        owner.set(2L); UUID bob = transaction.execute(status -> tags.createOrGetTag("private").getId());
        assertNotEquals(alice, bob); assertEquals(1, tags.findAll().size());
        assertTrue(tags.findById(alice).isEmpty());
        assertThrows(ResponseStatusException.class, () -> transaction.execute(status -> { tags.deleteById(alice); return null; }));
        assertThrows(ResponseStatusException.class, () -> tags.findTagsByNoteId(101L));
        assertThrows(ResponseStatusException.class, () -> tags.countNotesByTagId(alice));
    }
    @Test void taskCreationIgnoresClaimedOwnerAndForeignMutationsNeverCommit() {
        Task input = new Task(); input.setTitle("Owned"); input.setUserId(2L);
        Long id = transaction.execute(status -> tasks.createTask(input).getId()); assertEquals(1L, input.getUserId());
        owner.set(2L); assertTrue(tasks.findById(id).isEmpty());
        assertThrows(ResponseStatusException.class, () -> tasks.findByUserId(1L));
        assertThrows(ResponseStatusException.class, () -> transaction.execute(status -> tasks.completeTask(id)));
        Task forged = new Task(); forged.setId(id); forged.setUserId(2L); forged.setTitle("Overwrite");
        assertThrows(ResponseStatusException.class, () -> transaction.execute(status -> tasks.updateTask(forged)));
        assertThrows(ResponseStatusException.class, () -> transaction.execute(status -> { tasks.deleteTask(id); return null; }));
        assertEquals("Owned", jdbc.queryForObject("SELECT title FROM tasks WHERE id=?", String.class, id));
    }
    @Test void tasksCannotAttachToForeignNotesOrUseForeignParents() {
        Task input = new Task(); input.setTitle("Owned"); Long id = transaction.execute(status -> tasks.createTask(input).getId());
        assertThrows(ResponseStatusException.class, () -> transaction.execute(status -> { tasks.linkTaskToNote(id, 202L); return null; }));
        transaction.execute(status -> { tasks.linkTaskToNote(id, 101L); return null; });
        assertEquals(1, transaction.execute(status -> tasks.findTasksLinkedToNote(101L).size()).intValue());
        owner.set(2L); Task child = new Task(); child.setTitle("Foreign parent"); child.setParentTaskId(id);
        assertThrows(ResponseStatusException.class, () -> transaction.execute(status -> tasks.createTask(child)));
        assertThrows(ResponseStatusException.class, () -> tasks.findSubtasks(id));
    }
    @Test void noteRelationshipsRequireBothOwnersIncludingLegacyCrossOwnerLinks() {
        assertThrows(ResponseStatusException.class, () -> transaction.execute(status -> links.createLink(101L, 202L, "REFERENCE")));
        jdbc.update("INSERT INTO application.note_links(link_id,source_note_id,target_note_id,link_type) VALUES (?,101,202,'LEGACY')", UUID.randomUUID());
        assertTrue(links.getAllLinks().isEmpty()); assertTrue(links.getOutgoingLinks(101L).isEmpty());
        assertThrows(ResponseStatusException.class, () -> links.getIncomingLinks(202L));
    }
    @Test void noteSaveRejectsForeignTagsWithoutChangingEitherNote() {
        UUID tagId = transaction.execute(status -> tags.createOrGetTag("mine").getId());
        owner.set(2L);
        Note note = notes.findById(202L).orElseThrow();
        Tag forged = new Tag("renamed"); forged.setId(tagId);
        note.setTags(new HashSet<>(Set.of(forged)));
        var service = context.getBean(OptimizedNoteService.class);
        assertThrows(ResponseStatusException.class, () -> transaction.execute(status -> service.save(note)));
        assertEquals("mine", jdbc.queryForObject("SELECT name FROM application.tags WHERE tag_id=?", String.class, tagId));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM application.note_tags", Integer.class));
    }
}

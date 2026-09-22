package com.modulo.graph;

import com.modulo.aspect.NoTrace;
import com.modulo.graph.dto.GraphEdge;
import com.modulo.graph.dto.GraphNode;
import com.modulo.graph.dto.RelatedNote;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Projects notes and their {@code [[links]]} into Neo4j as {@code (:Note)} nodes and
 * {@code [:LINKS_TO]} relationships, and runs the graph queries that back the
 * backlinks, related-notes and local-subgraph features.
 *
 * <p>Postgres remains the source of truth; Neo4j is a derived, eventually-consistent
 * read model. Every method tolerates Neo4j being unavailable: writes are best-effort
 * (log and swallow) so note operations never fail, and reads return empty results.</p>
 *
 * <p>When the graph feature is disabled, no {@link Driver} bean exists and
 * {@link #isAvailable()} returns {@code false}; all operations become no-ops.</p>
 */
@Service
public class GraphProjectionService {
    @org.springframework.beans.factory.annotation.Autowired private com.modulo.repository.NoteRepository notes;
    private List<Long> ownedIds(Long center) {
        if (center != null && notes.findById(center).isEmpty()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Note not found");
        return notes.findAll().stream().map(com.modulo.entity.Note::getId).collect(java.util.stream.Collectors.toList());
    }


    private static final Logger logger = LoggerFactory.getLogger(GraphProjectionService.class);

    /** Optional so the service still loads when the graph feature is disabled. */
    private final Optional<Driver> driver;

    @Autowired
    public GraphProjectionService(Optional<Driver> driver) {
        this.driver = driver;
    }

    /**
     * @return true when a Neo4j driver is configured (feature enabled).
     *
     * <p>Excluded from tracing: it is a trivial guard called at the top of every
     * other method (and during bean initialisation). Tracing it via the service
     * pointcut also makes the whole context fail to load in tests that mock
     * {@code TracingService}, because the mocked advice returns {@code null} for
     * this primitive {@code boolean} return type.</p>
     */
    @NoTrace
    public boolean isAvailable() {
        return driver.isPresent();
    }

    // ------------------------------------------------------------------
    // Projection writes (best-effort, never throw)
    // ------------------------------------------------------------------

    /** Upsert a note node. Called on note create/update. */
    public void upsertNote(Long noteId, String title) {
        if (noteId == null) {
            return;
        }
        run("MERGE (n:Note {id: $id}) SET n.title = $title",
            Values.parameters("id", noteId, "title", title == null ? "" : title),
            "upsertNote(" + noteId + ")");
    }

    /** Remove a note node and its relationships. Called on note delete. */
    public void deleteNote(Long noteId) {
        if (noteId == null) {
            return;
        }
        run("MATCH (n:Note {id: $id}) DETACH DELETE n",
            Values.parameters("id", noteId),
            "deleteNote(" + noteId + ")");
    }

    /** Upsert a directed {@code [:LINKS_TO]} edge, creating endpoint nodes if needed. */
    public void upsertLink(Long sourceId, String sourceTitle, Long targetId, String targetTitle, String linkType) {
        if (sourceId == null || targetId == null) {
            return;
        }
        run("MERGE (s:Note {id: $sourceId}) SET s.title = coalesce($sourceTitle, s.title) " +
            "MERGE (t:Note {id: $targetId}) SET t.title = coalesce($targetTitle, t.title) " +
            "MERGE (s)-[r:LINKS_TO]->(t) SET r.type = $linkType",
            Values.parameters(
                "sourceId", sourceId, "sourceTitle", sourceTitle,
                "targetId", targetId, "targetTitle", targetTitle,
                "linkType", linkType == null ? "REFERENCE" : linkType),
            "upsertLink(" + sourceId + "->" + targetId + ")");
    }

    /** Remove the directed edge between two notes. Called on link delete. */
    public void deleteLink(Long sourceId, Long targetId) {
        if (sourceId == null || targetId == null) {
            return;
        }
        run("MATCH (s:Note {id: $sourceId})-[r:LINKS_TO]->(t:Note {id: $targetId}) DELETE r",
            Values.parameters("sourceId", sourceId, "targetId", targetId),
            "deleteLink(" + sourceId + "->" + targetId + ")");
    }

    // ------------------------------------------------------------------
    // Graph reads
    // ------------------------------------------------------------------

    /**
     * #251 — incoming links: notes that link TO the given note.
     * @return source node ids/titles ordered by title.
     */
    public List<GraphNode> getBacklinks(Long noteId) {
        List<Long> owned = ownedIds(noteId);
        if (!isAvailable() || noteId == null) {
            return Collections.emptyList();
        }
        try (Session session = driver.get().session()) {
            return session.readTransaction(tx -> {
                List<GraphNode> result = new ArrayList<>();
                tx.run("MATCH (src:Note)-[:LINKS_TO]->(n:Note {id: $id}) " +
                       "WHERE src.id IN $owned AND n.id IN $owned RETURN src.id AS id, src.title AS title ORDER BY toLower(coalesce(src.title, '')), src.id",
                       Values.parameters("id", noteId, "owned", owned))
                  .forEachRemaining(rec -> result.add(
                      new GraphNode(rec.get("id").asLong(), nullableStr(rec.get("title")))));
                return result;
            });
        } catch (Exception e) {
            logger.warn("getBacklinks({}) failed, returning empty: {}", noteId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * #253 — related notes via shared neighbors. Two notes are "related" when they share
     * neighbors in the link graph but are not themselves directly linked (so results are
     * non-trivial, not just the note's own links). Treats links as undirected.
     * @return related notes ranked by number of shared neighbors.
     */
    public List<RelatedNote> getRelatedNotes(Long noteId, int limit) {
        List<Long> owned = ownedIds(noteId);
        if (!isAvailable() || noteId == null) {
            return Collections.emptyList();
        }
        try (Session session = driver.get().session()) {
            return session.readTransaction(tx -> {
                List<RelatedNote> result = new ArrayList<>();
                tx.run("MATCH (n:Note {id: $id})-[:LINKS_TO]-(neighbor:Note)-[:LINKS_TO]-(related:Note) " +
                       "WHERE n.id IN $owned AND neighbor.id IN $owned AND related.id IN $owned AND related.id <> $id AND NOT (n)-[:LINKS_TO]-(related) " +
                       "RETURN related.id AS id, related.title AS title, " +
                       "       count(DISTINCT neighbor) AS score " +
                       "ORDER BY score DESC, toLower(coalesce(related.title, '')) " +
                       "LIMIT $limit",
                       Values.parameters("id", noteId, "limit", limit, "owned", owned))
                  .forEachRemaining(rec -> result.add(new RelatedNote(
                      rec.get("id").asLong(), nullableStr(rec.get("title")), rec.get("score").asInt())));
                return result;
            });
        } catch (Exception e) {
            logger.warn("getRelatedNotes({}) failed, returning empty: {}", noteId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * #254 — local subgraph: the note's neighborhood up to {@code depth} hops, returned as
     * nodes plus the directed edges among them. Treats links as undirected for traversal.
     */
    public NeighborhoodResult getNeighborhood(Long noteId, int depth) {
        List<Long> owned = ownedIds(noteId);
        if (!isAvailable() || noteId == null) {
            return NeighborhoodResult.empty();
        }
        // depth is interpolated (validated 1..3 by the caller) because Cypher does not
        // allow a parameter for variable-length path bounds.
        int safeDepth = Math.max(1, Math.min(depth, 3));
        try (Session session = driver.get().session()) {
            return session.readTransaction(tx -> {
                List<GraphNode> nodes = new ArrayList<>();
                List<Long> ids = new ArrayList<>();
                // *0.. includes the center node itself.
                tx.run("MATCH path=(n:Note {id: $id})-[:LINKS_TO*0.." + safeDepth + "]-(m:Note) " +
                       "WHERE all(node IN nodes(path) WHERE node.id IN $owned) RETURN DISTINCT m.id AS id, m.title AS title",
                       Values.parameters("id", noteId, "owned", owned))
                  .forEachRemaining(rec -> {
                      long id = rec.get("id").asLong();
                      ids.add(id);
                      nodes.add(new GraphNode(id, nullableStr(rec.get("title"))));
                  });

                List<GraphEdge> edges = new ArrayList<>();
                if (!ids.isEmpty()) {
                    tx.run("MATCH (a:Note)-[r:LINKS_TO]->(b:Note) " +
                           "WHERE a.id IN $ids AND b.id IN $ids " +
                           "RETURN a.id AS source, b.id AS target, r.type AS type",
                           Values.parameters("ids", ids))
                      .forEachRemaining(rec -> edges.add(new GraphEdge(
                          rec.get("source").asLong(), rec.get("target").asLong(), nullableStr(rec.get("type")))));
                }
                return new NeighborhoodResult(nodes, edges);
            });
        } catch (Exception e) {
            logger.warn("getNeighborhood({}) failed, returning empty: {}", noteId, e.getMessage());
            return NeighborhoodResult.empty();
        }
    }

    /** @return total node count in the projection (used for backfill / health checks). */
    public long nodeCount() {
        List<Long> owned = ownedIds(null);
        if (!isAvailable()) {
            return -1;
        }
        try (Session session = driver.get().session()) {
            return session.readTransaction(tx ->
                tx.run("MATCH (n:Note) WHERE n.id IN $owned RETURN count(n) AS c", Values.parameters("owned", owned)).single().get("c").asLong());
        } catch (Exception e) {
            logger.warn("nodeCount() failed: {}", e.getMessage());
            return -1;
        }
    }

    // ------------------------------------------------------------------
    // internals
    // ------------------------------------------------------------------

    private void run(String cypher, org.neo4j.driver.Value params, String label) {
        if (!isAvailable()) {
            return;
        }
        try (Session session = driver.get().session()) {
            session.writeTransaction(tx -> {
                tx.run(cypher, params);
                return null;
            });
        } catch (Exception e) {
            // Eventually-consistent read model: never fail the originating write.
            logger.warn("Graph projection {} failed (Neo4j unavailable?): {}", label, e.getMessage());
        }
    }

    private static String nullableStr(org.neo4j.driver.Value v) {
        return v == null || v.isNull() ? null : v.asString();
    }

    /** Result holder for a neighborhood query. */
    public static class NeighborhoodResult {
        private final List<GraphNode> nodes;
        private final List<GraphEdge> edges;

        public NeighborhoodResult(List<GraphNode> nodes, List<GraphEdge> edges) {
            this.nodes = nodes;
            this.edges = edges;
        }

        public static NeighborhoodResult empty() {
            return new NeighborhoodResult(Collections.emptyList(), Collections.emptyList());
        }

        public List<GraphNode> getNodes() { return nodes; }
        public List<GraphEdge> getEdges() { return edges; }
    }
}

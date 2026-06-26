package com.modulo.service;

import com.modulo.entity.Note;
import com.modulo.entity.NoteLink;
import com.modulo.graph.dto.UnlinkedMentionDto;
import com.modulo.repository.NoteLinkRepository;
import com.modulo.repository.NoteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Finds "unlinked mentions" (#252): notes whose text mentions the current note's title
 * (or aliases) but do not yet {@code [[link]]} it. Runs entirely against Postgres (the
 * source of truth) — no Neo4j dependency.
 *
 * <p>Matching is case-insensitive and word-boundary aware. Performance is guarded by
 * pushing a {@code LIKE} pre-filter to the database (so only candidate notes are scanned
 * in memory) and capping the number of returned mentions.</p>
 */
@Service
public class UnlinkedMentionsService {

    private static final Logger logger = LoggerFactory.getLogger(UnlinkedMentionsService.class);

    private static final int DEFAULT_LIMIT = 50;
    private static final int SNIPPET_RADIUS = 80;
    private static final int MIN_TERM_LENGTH = 3;

    private final NoteRepository noteRepository;
    private final NoteLinkRepository noteLinkRepository;

    @Autowired
    public UnlinkedMentionsService(NoteRepository noteRepository, NoteLinkRepository noteLinkRepository) {
        this.noteRepository = noteRepository;
        this.noteLinkRepository = noteLinkRepository;
    }

    @Transactional(readOnly = true)
    public List<UnlinkedMentionDto> findUnlinkedMentions(Long noteId) {
        Optional<Note> targetOpt = noteRepository.findById(noteId);
        if (!targetOpt.isPresent()) {
            throw new IllegalArgumentException("Note not found: " + noteId);
        }
        Note target = targetOpt.get();

        // Terms to look for: the title plus any comma-separated aliases stored in metadata.
        Set<String> terms = new LinkedHashSet<>();
        if (target.getTitle() != null && target.getTitle().trim().length() >= MIN_TERM_LENGTH) {
            terms.add(target.getTitle().trim());
        }
        String aliases = target.getMetadata() != null ? target.getMetadata().get("aliases") : null;
        if (aliases != null) {
            for (String alias : aliases.split(",")) {
                String a = alias.trim();
                if (a.length() >= MIN_TERM_LENGTH) {
                    terms.add(a);
                }
            }
        }
        if (terms.isEmpty()) {
            return new ArrayList<>();
        }

        // Notes that already link TO this note must be excluded — they are not "unlinked".
        Set<Long> alreadyLinking = new LinkedHashSet<>();
        for (NoteLink link : noteLinkRepository.findByTargetNoteId(noteId)) {
            if (link.getSourceNote() != null) {
                alreadyLinking.add(link.getSourceNote().getId());
            }
        }

        List<UnlinkedMentionDto> mentions = new ArrayList<>();
        Set<Long> seen = new LinkedHashSet<>();

        for (String term : terms) {
            Pattern wordBoundary = Pattern.compile("(?i)\\b" + Pattern.quote(term) + "\\b");

            // DB-side pre-filter: only notes whose title/content contain the term.
            for (Note candidate : noteRepository.findByTitleOrContentContainingIgnoreCase(term)) {
                Long cid = candidate.getId();
                if (cid == null || cid.equals(noteId) || alreadyLinking.contains(cid) || seen.contains(cid)) {
                    continue;
                }
                String content = candidate.getContent() != null ? candidate.getContent() : "";
                Matcher m = wordBoundary.matcher(content);
                if (m.find()) {
                    mentions.add(new UnlinkedMentionDto(
                        cid, candidate.getTitle(), buildSnippet(content, m.start(), m.end()), term));
                    seen.add(cid);
                    if (mentions.size() >= DEFAULT_LIMIT) {
                        return mentions;
                    }
                }
            }
        }

        logger.debug("Found {} unlinked mentions for note {}", mentions.size(), noteId);
        return mentions;
    }

    /** Build a "…context around the match…" snippet centered on the matched text. */
    private String buildSnippet(String content, int start, int end) {
        int from = Math.max(0, start - SNIPPET_RADIUS);
        int to = Math.min(content.length(), end + SNIPPET_RADIUS);
        String snippet = content.substring(from, to).replaceAll("\\s+", " ").trim();
        if (from > 0) {
            snippet = "…" + snippet;
        }
        if (to < content.length()) {
            snippet = snippet + "…";
        }
        return snippet;
    }
}

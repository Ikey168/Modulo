package com.modulo.service;

import com.modulo.entity.Tag;
import com.modulo.repository.TagRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class TagService {
    @Autowired private com.modulo.security.AuthenticatedUserService users;
    @Autowired private com.modulo.repository.NoteRepository notes;


    private final TagRepository tagRepository;

    @Autowired
    public TagService(TagRepository tagRepository) {
        this.tagRepository = tagRepository;
    }

    public List<Tag> findAll() {
        return tagRepository.findAll();
    }

    public Optional<Tag> findById(UUID id) {
        return tagRepository.findById(id);
    }

    public Optional<Tag> findByName(String name) {
        return tagRepository.findByName(name);
    }

    public List<Tag> searchByName(String query) {
        return tagRepository.findByNameContainingIgnoreCase(query);
    }

    /** Resolve existing relationships from owned rows, never merge caller-supplied tag entities. */
    public java.util.Set<Tag> resolveOwned(java.util.Set<Tag> requested) {
        java.util.Set<Tag> result = new java.util.HashSet<>();
        if (requested == null) return result;
        for (Tag tag : requested) {
            result.add(tag.getId() == null ? createOrGetTag(tag.getName()) :
                findById(tag.getId()).orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Tag not found")));
        }
        return result;
    }

    public Tag save(Tag tag) {
        if (tag.getId() != null) tagRepository.findById(tag.getId()).orElseThrow(() ->
            new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Tag not found"));
        tag.setUserId(users.requireUserId());
        return tagRepository.save(tag);
    }

    public Tag createOrGetTag(String name) {
        String trimmedName = name.trim();
        if (trimmedName.isEmpty()) {
            throw new IllegalArgumentException("Tag name cannot be empty");
        }
        
        return tagRepository.findByName(trimmedName)
                .orElseGet(() -> save(new Tag(trimmedName)));
    }

    public void deleteById(UUID id) {
        Tag tag = findById(id).orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Tag not found"));
        tagRepository.delete(tag);
    }

    public List<Tag> findTagsByNoteId(Long noteId) {
        notes.findByIdAndUserId(noteId, users.requireUserId()).orElseThrow(() ->
            new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Note not found"));
        return tagRepository.findByNoteId(noteId);
    }

    public Long countNotesByTagId(UUID tagId) {
        findById(tagId).orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Tag not found"));
        return tagRepository.countNotesByTagId(tagId);
    }

    public boolean existsByName(String name) {
        return tagRepository.findByName(name).isPresent();
    }
}

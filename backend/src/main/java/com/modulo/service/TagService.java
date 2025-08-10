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

    public Tag save(Tag tag) {
        return tagRepository.save(tag);
    }

    public Tag createOrGetTag(String name) {
        String trimmedName = name.trim();
        if (trimmedName.isEmpty()) {
            throw new IllegalArgumentException("Tag name cannot be empty");
        }
        
        return tagRepository.findByName(trimmedName)
                .orElseGet(() -> tagRepository.save(new Tag(trimmedName)));
    }

    public void deleteById(UUID id) {
        tagRepository.deleteById(id);
    }

    public List<Tag> findTagsByNoteId(Long noteId) {
        return tagRepository.findByNoteId(noteId);
    }

    public Long countNotesByTagId(UUID tagId) {
        return tagRepository.countNotesByTagId(tagId);
    }

    public boolean existsByName(String name) {
        return tagRepository.findByName(name).isPresent();
    }
}

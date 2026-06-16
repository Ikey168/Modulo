package com.modulo.service;

import com.modulo.entity.Tag;
import com.modulo.repository.TagRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Tag Service Tests")
class TagServiceTest {

    @Mock
    private TagRepository tagRepository;

    @InjectMocks
    private TagService tagService;

    private Tag tag;
    private UUID id;

    @BeforeEach
    void setUp() {
        id = UUID.randomUUID();
        tag = new Tag("work");
        tag.setId(id);
    }

    @Test
    void findAll() {
        when(tagRepository.findAll()).thenReturn(List.of(tag));
        assertThat(tagService.findAll()).containsExactly(tag);
    }

    @Test
    void findById() {
        when(tagRepository.findById(id)).thenReturn(Optional.of(tag));
        assertThat(tagService.findById(id)).contains(tag);
    }

    @Test
    void findByName() {
        when(tagRepository.findByName("work")).thenReturn(Optional.of(tag));
        assertThat(tagService.findByName("work")).contains(tag);
    }

    @Test
    void searchByName() {
        when(tagRepository.findByNameContainingIgnoreCase("wo")).thenReturn(List.of(tag));
        assertThat(tagService.searchByName("wo")).containsExactly(tag);
    }

    @Test
    void save() {
        when(tagRepository.save(tag)).thenReturn(tag);
        assertThat(tagService.save(tag)).isSameAs(tag);
    }

    @Test
    void createOrGetTagReturnsExisting() {
        when(tagRepository.findByName("work")).thenReturn(Optional.of(tag));

        assertThat(tagService.createOrGetTag("work")).isSameAs(tag);
        verify(tagRepository, never()).save(any());
    }

    @Test
    void createOrGetTagCreatesNew() {
        when(tagRepository.findByName("new")).thenReturn(Optional.empty());
        when(tagRepository.save(any(Tag.class))).thenAnswer(inv -> inv.getArgument(0));

        Tag created = tagService.createOrGetTag("  new  ");

        assertThat(created.getName()).isEqualTo("new");
        verify(tagRepository).save(any(Tag.class));
    }

    @Test
    void createOrGetTagRejectsEmpty() {
        assertThatThrownBy(() -> tagService.createOrGetTag("   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void deleteById() {
        tagService.deleteById(id);
        verify(tagRepository).deleteById(id);
    }

    @Test
    void findTagsByNoteId() {
        when(tagRepository.findByNoteId(5L)).thenReturn(List.of(tag));
        assertThat(tagService.findTagsByNoteId(5L)).containsExactly(tag);
    }

    @Test
    void countNotesByTagId() {
        when(tagRepository.countNotesByTagId(id)).thenReturn(3L);
        assertThat(tagService.countNotesByTagId(id)).isEqualTo(3L);
    }

    @Test
    void existsByName() {
        when(tagRepository.findByName("work")).thenReturn(Optional.of(tag));
        assertThat(tagService.existsByName("work")).isTrue();

        when(tagRepository.findByName("missing")).thenReturn(Optional.empty());
        assertThat(tagService.existsByName("missing")).isFalse();
    }
}

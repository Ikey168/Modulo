package com.modulo.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("NoteLink Entity Tests")
class NoteLinkTest {

    @Test
    @DisplayName("constructor and getters/setters round-trip")
    void fields() {
        Note source = new Note("a", "a");
        Note target = new Note("b", "b");

        NoteLink link = new NoteLink(source, target, "REFERENCES");
        assertThat(link.getSourceNote()).isSameAs(source);
        assertThat(link.getTargetNote()).isSameAs(target);
        assertThat(link.getLinkType()).isEqualTo("REFERENCES");

        UUID id = UUID.randomUUID();
        link.setId(id);
        link.setLinkType("RELATED");
        assertThat(link.getId()).isEqualTo(id);
        assertThat(link.getLinkType()).isEqualTo("RELATED");
    }

    @Test
    @DisplayName("equals, hashCode and toString behave consistently")
    void equalsHashCodeToString() {
        UUID id = UUID.randomUUID();
        NoteLink a = new NoteLink();
        a.setId(id);
        NoteLink b = new NoteLink();
        b.setId(id);

        assertThat(a).isEqualTo(b);
        assertThat(a.hashCode()).isEqualTo(b.hashCode());
        assertThat(a).isEqualTo(a);
        assertThat(a).isNotEqualTo(null);
        assertThat(a).isNotEqualTo("not a link");
        assertThat(a.toString()).isNotNull();
    }
}

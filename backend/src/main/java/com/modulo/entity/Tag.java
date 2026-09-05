package com.modulo.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;

import javax.persistence.*;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "tags", schema = "application", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "name"}))
public class Tag {

    @Id
    @GeneratedValue
    @Column(name = "tag_id")
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "user_id")
    private Long userId;
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    // Inverse side of Note.tags. Excluded from JSON so serializing a Note's
    // tags doesn't recurse back into notes (Note -> tags -> Tag -> notes ...).
    // Excluded from JSON: serializing this lazy back-reference both triggers a
    // LazyInitializationException (session closed when open-in-view=false) and
    // creates an infinite Note -> tags -> Tag -> notes recursion.
    @JsonIgnore
    @ManyToMany(mappedBy = "tags", fetch = FetchType.LAZY)
    private Set<Note> notes = new HashSet<>();

    public Tag() {}

    public Tag(String name) {
        this.name = name;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Set<Note> getNotes() {
        return notes;
    }

    public void setNotes(Set<Note> notes) {
        this.notes = notes;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Tag)) return false;
        Tag tag = (Tag) o;
        return name != null && name.equals(tag.name) && java.util.Objects.equals(userId, tag.userId);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(name, userId);
    }

    @Override
    public String toString() {
        return "Tag{" +
                "id=" + id +
                ", name='" + name + '\'' +
                '}';
    }
}

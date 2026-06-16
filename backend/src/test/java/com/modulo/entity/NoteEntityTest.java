package com.modulo.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Note Entity Tests")
class NoteEntityTest {

    @Test
    @DisplayName("constructors initialise fields and timestamps")
    void constructors() {
        Note empty = new Note();
        assertThat(empty.getCreatedAt()).isNotNull();
        assertThat(empty.getUpdatedAt()).isNotNull();

        Note two = new Note("Title", "Content");
        assertThat(two.getTitle()).isEqualTo("Title");
        assertThat(two.getContent()).isEqualTo("Content");
        assertThat(two.getMarkdownContent()).isEqualTo("Content");

        Note three = new Note("T", "C", "# md");
        assertThat(three.getMarkdownContent()).isEqualTo("# md");
    }

    @Test
    @DisplayName("scalar getters and setters round-trip")
    void scalarFields() {
        Note n = new Note();
        LocalDateTime now = LocalDateTime.now();

        n.setId(5L);
        n.setTitle("t");
        n.setContent("c");
        n.setMarkdownContent("m");
        n.setCreatedAt(now);
        n.setUpdatedAt(now);
        n.setVersion(3L);
        n.setLastEditor("editor");
        n.setUserId(99L);
        n.setIsPublic(true);
        n.setLastViewedAt(now);
        n.setIpfsCid("cid");
        n.setContentHash("hash");
        n.setBlockchainTxHash("tx");
        n.setBlockchainNoteId(7L);
        n.setIsOnBlockchain(true);
        n.setIsDecentralized(true);
        n.setIpfsUploadedAt(now);
        n.setBlockchainRegisteredAt(now);
        n.setAccessControlEnabled(true);
        n.setOwnerAddress("0xabc");
        n.setAccessControlTxHash("0xdef");

        assertThat(n.getId()).isEqualTo(5L);
        assertThat(n.getTitle()).isEqualTo("t");
        assertThat(n.getContent()).isEqualTo("c");
        assertThat(n.getMarkdownContent()).isEqualTo("m");
        assertThat(n.getCreatedAt()).isEqualTo(now);
        assertThat(n.getUpdatedAt()).isEqualTo(now);
        assertThat(n.getVersion()).isEqualTo(3L);
        assertThat(n.getLastEditor()).isEqualTo("editor");
        assertThat(n.getUserId()).isEqualTo(99L);
        assertThat(n.getIsPublic()).isTrue();
        assertThat(n.getLastViewedAt()).isEqualTo(now);
        assertThat(n.getIpfsCid()).isEqualTo("cid");
        assertThat(n.getContentHash()).isEqualTo("hash");
        assertThat(n.getBlockchainTxHash()).isEqualTo("tx");
        assertThat(n.getBlockchainNoteId()).isEqualTo(7L);
        assertThat(n.getIsOnBlockchain()).isTrue();
        assertThat(n.getIsDecentralized()).isTrue();
        assertThat(n.getIpfsUploadedAt()).isEqualTo(now);
        assertThat(n.getBlockchainRegisteredAt()).isEqualTo(now);
        assertThat(n.getAccessControlEnabled()).isTrue();
        assertThat(n.getOwnerAddress()).isEqualTo("0xabc");
        assertThat(n.getAccessControlTxHash()).isEqualTo("0xdef");
    }

    @Test
    @DisplayName("metadata map round-trips")
    void metadata() {
        Note n = new Note();
        Map<String, String> meta = new HashMap<>();
        meta.put("k", "v");
        n.setMetadata(meta);
        assertThat(n.getMetadata()).containsEntry("k", "v");
    }

    @Test
    @DisplayName("tag add/remove helpers maintain the set")
    void tagHelpers() {
        Note n = new Note();
        Tag tag = new Tag("work");

        n.addTag(tag);
        assertThat(n.getTags()).contains(tag);

        n.removeTag(tag);
        assertThat(n.getTags()).doesNotContain(tag);
    }

    @Test
    @DisplayName("attachment add/remove helpers maintain the set")
    void attachmentHelpers() {
        Note n = new Note();
        Attachment a = Attachment.builder().blobName("b").build();

        n.addAttachment(a);
        assertThat(n.getAttachments()).contains(a);

        n.removeAttachment(a);
        assertThat(n.getAttachments()).doesNotContain(a);
    }

    @Test
    @DisplayName("task add/remove helpers maintain the set")
    void taskHelpers() {
        Note n = new Note();
        Task t = new Task("title", "desc", 1L);

        n.addTask(t);
        assertThat(n.getTasks()).contains(t);

        n.removeTask(t);
        assertThat(n.getTasks()).doesNotContain(t);
    }

    @Test
    @DisplayName("link helpers maintain the link sets")
    void linkHelpers() {
        Note source = new Note("a", "a");
        Note target = new Note("b", "b");
        NoteLink out = new NoteLink(source, target, "REFERENCES");
        NoteLink in = new NoteLink(target, source, "REFERENCES");

        source.addOutgoingLink(out);
        source.addIncomingLink(in);
        assertThat(source.getOutgoingLinks()).contains(out);
        assertThat(source.getIncomingLinks()).contains(in);

        source.removeOutgoingLink(out);
        source.removeIncomingLink(in);
        assertThat(source.getOutgoingLinks()).doesNotContain(out);
        assertThat(source.getIncomingLinks()).doesNotContain(in);
    }
}

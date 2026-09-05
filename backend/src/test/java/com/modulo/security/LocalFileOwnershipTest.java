package com.modulo.security;

import com.modulo.editor.LocalFileController;
import com.modulo.entity.*;
import com.modulo.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.nio.file.*;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class LocalFileOwnershipTest {
    @TempDir Path directory;
    NoteRepository notes;
    AttachmentRepository attachments;
    MockMvc http;
    Note note;
    @BeforeEach void setup() throws Exception {
        notes = mock(NoteRepository.class); attachments = mock(AttachmentRepository.class);
        var users = mock(AuthenticatedUserService.class); when(users.requireUserId()).thenReturn(1L);
        var controller = new LocalFileController(notes, attachments);
        ReflectionTestUtils.setField(controller, "users", users);
        ReflectionTestUtils.setField(controller, "uploadDir", directory.toString());
        http = MockMvcBuilders.standaloneSetup(controller).build();
        note = new Note("private", "body"); note.setId(10L); note.setUserId(1L);
        Files.createDirectories(directory.resolve("10"));
        Files.writeString(directory.resolve("10/file.txt"), "private bytes");
    }
    @Test void foreignFileReadListAndDeleteAreRejectedBeforeAttachmentAccess() throws Exception {
        when(notes.findByIdAndUserId(10L, 1L)).thenReturn(Optional.empty());
        http.perform(get("/api/files/10/file.txt").header("X-User-Id", "admin")).andExpect(status().isNotFound());
        http.perform(get("/api/notes/10/files")).andExpect(status().isNotFound());
        http.perform(delete("/api/notes/10/files/7")).andExpect(status().isNotFound());
        verifyNoInteractions(attachments);
        Assertions.assertTrue(Files.exists(directory.resolve("10/file.txt")));
    }
    @Test void ownedFileIsServedPrivatelyButSymlinkEscapeIsRejected() throws Exception {
        when(notes.findByIdAndUserId(10L, 1L)).thenReturn(Optional.of(note));
        when(attachments.findByBlobName("file.txt")).thenReturn(Optional.of(Attachment.builder().note(note).isActive(true).build()));
        http.perform(get("/api/files/10/file.txt")).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(content().string("private bytes"));
        Files.writeString(directory.resolve("secret.txt"), "outside");
        Files.createSymbolicLink(directory.resolve("10/escape.txt"), directory.resolve("secret.txt"));
        when(attachments.findByBlobName("escape.txt")).thenReturn(Optional.of(Attachment.builder().note(note).isActive(true).build()));
        http.perform(get("/api/files/10/escape.txt")).andExpect(status().isNotFound());
    }
}

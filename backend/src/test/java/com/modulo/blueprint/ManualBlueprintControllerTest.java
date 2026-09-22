package com.modulo.blueprint;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.modulo.blueprint.interpreter.BlueprintInterpreterService;
import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import com.modulo.security.AuthenticatedUserService;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ManualBlueprintControllerTest {
  final BlueprintRepository blueprints = mock(BlueprintRepository.class);
  final NoteRepository notes = mock(NoteRepository.class);
  final AuthenticatedUserService users = mock(AuthenticatedUserService.class);
  final BlueprintInterpreterService interpreter = mock(BlueprintInterpreterService.class);
  final ManualBlueprintController controller = new ManualBlueprintController(blueprints, notes, users, interpreter);
  final BlueprintEntry blueprint = new BlueprintEntry();
  final Note note = new Note("Procedure", "Inspect input");

  @BeforeEach void setup() {
    when(users.requireUserId()).thenReturn(7L); blueprint.setOwnerId(7L); note.setUserId(7L); note.setId(1L);
    when(blueprints.findByName("review")).thenReturn(Optional.of(blueprint)); when(notes.findById(1L)).thenReturn(Optional.of(note));
  }
  @Test void confirmedRunPreservesIdempotencyKeyAndOwnerScopedNote() {
    UUID key = UUID.randomUUID(), run = UUID.randomUUID();
    when(interpreter.fireManual(blueprint, "manual", note, key)).thenReturn(run);
    assertThat(controller.run("review", new ManualBlueprintController.RunRequest(key, 1L, "manual", true))).containsEntry("runId", run);
    verify(interpreter).fireManual(blueprint, "manual", note, key);
  }
  @Test void confirmationIsRequiredBeforeAnyExecution() {
    assertThatThrownBy(() -> controller.run("review", new ManualBlueprintController.RunRequest(UUID.randomUUID(), 1L, "manual", false))).isInstanceOf(ResponseStatusException.class);
    verifyNoInteractions(interpreter);
  }
  @Test void foreignNotesCannotBeInjectedIntoOwnedBlueprints() {
    note.setUserId(8L);
    assertThatThrownBy(() -> controller.run("review", new ManualBlueprintController.RunRequest(UUID.randomUUID(), 1L, "manual", true))).isInstanceOf(ResponseStatusException.class);
    verifyNoInteractions(interpreter);
  }
  @Test void foreignBlueprintCannotBeInvoked() {
    blueprint.setOwnerId(8L);
    assertThatThrownBy(() -> controller.run("review", new ManualBlueprintController.RunRequest(UUID.randomUUID(), 1L, "manual", true))).isInstanceOf(ResponseStatusException.class);
    verifyNoInteractions(interpreter);
  }
}

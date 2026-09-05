package com.modulo.blueprint.approval;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.security.KeyPairGenerator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ApprovalSigningConfigurationTest {
  @TempDir Path directory;

  @Test
  void requiredAndMismatchedKeysFailClosed() throws Exception {
    assertThrows(
        IllegalStateException.class,
        () -> new ApprovalSigningService(null, new ObjectMapper(), "", "", true));
    var one = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
    var two = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
    var secret = directory.resolve("private.pk8");
    var visible = directory.resolve("public.spki");
    Files.write(secret, one.getPrivate().getEncoded());
    Files.write(visible, two.getPublic().getEncoded());
    assertThrows(
        IllegalStateException.class,
        () ->
            new ApprovalSigningService(
                null, new ObjectMapper(), secret.toString(), visible.toString(), true));
  }
}

package com.modulo.plugin.submission;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginException;
import com.modulo.plugin.api.PluginInfo;
import com.modulo.plugin.api.PluginRuntime;
import com.modulo.plugin.api.PluginType;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.manager.PluginLoader;
import com.modulo.plugin.manager.PluginManager;
import com.modulo.plugin.manager.PluginSecurityManager;
import com.modulo.plugin.registry.PluginRegistry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * The EXTERNAL-only marketplace policy (#395): image submissions validate
 * with digest pinning and permission-allowlist checks, JAR submissions are
 * rejected by policy, approval produces the pending EXTERNAL registry
 * entry, and in-process loading of non-first-party origins is refused
 * mechanically.
 */
@DisplayName("Marketplace EXTERNAL-only policy (#395)")
class ExternalOnlyPolicyTest {

    private final PluginValidationService validation = new PluginValidationService();

    @BeforeEach
    void wireSecurityManager() {
        ReflectionTestUtils.setField(validation, "securityManager", new PluginSecurityManager());
    }

    private PluginSubmission imageSubmission() {
        PluginSubmission submission = new PluginSubmission();
        submission.setPluginName("Acme Notifier");
        submission.setVersion("1.0.0");
        submission.setDescription("Sends notifications from note events.");
        submission.setDeveloperName("Acme");
        submission.setDeveloperEmail("dev@acme.example");
        submission.setImageReference("ghcr.io/acme/notifier");
        submission.setImageDigest("sha256:" + "a".repeat(64));
        submission.setRequiredPermissions("notes.read,system.events.subscribe");
        return submission;
    }

    // ------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------

    @Test
    void wellFormedImageSubmissionValidates() {
        ValidationResult result = validation.validateSubmission(imageSubmission());
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.isSecurityCheckPassed()).isTrue();
        assertThat(result.isCompatibilityCheckPassed()).isTrue();
        // Provenance hook surfaces as a warning until cosign enforcement lands.
        assertThat(result.getWarnings()).anyMatch(w -> w.contains("provenance"));
    }

    @Test
    void unpinnedImageIsRejectedWithActionableMessage() {
        PluginSubmission submission = imageSubmission();
        submission.setImageDigest(null);
        ValidationResult result = validation.validateSubmission(submission);
        assertThat(result.getErrors()).anyMatch(e -> e.contains("sha256:"));

        submission.setImageDigest("latest");
        result = validation.validateSubmission(submission);
        assertThat(result.getErrors()).anyMatch(e -> e.contains("not pinned"));
    }

    @Test
    void disallowedPermissionIsRejected() {
        PluginSubmission submission = imageSubmission();
        submission.setRequiredPermissions("notes.read,admin.everything");
        ValidationResult result = validation.validateSubmission(submission);
        assertThat(result.getErrors())
            .anyMatch(e -> e.contains("admin.everything") && e.contains("allowlist"));
    }

    @Test
    void incompatibleContractVersionIsRejected() {
        PluginSubmission submission = imageSubmission();
        submission.setMinPlatformVersion("2.0.0");
        ValidationResult result = validation.validateSubmission(submission);
        assertThat(result.getErrors()).anyMatch(e -> e.contains("2.0.0"));
        assertThat(result.isCompatibilityCheckPassed()).isFalse();
    }

    @Test
    void jarSubmissionIsRejectedByPolicy() {
        PluginSubmission submission = imageSubmission();
        submission.setImageReference(null);
        submission.setJarFilePath("/tmp/plugin-submissions/whatever.jar");
        ValidationResult result = validation.validateSubmission(submission);
        assertThat(result.getErrors())
            .anyMatch(e -> e.startsWith("[POLICY]") && e.contains("EXTERNAL"));
    }

    @Test
    void submissionWithNeitherImageNorJarIsRejectedByPolicy() {
        PluginSubmission submission = imageSubmission();
        submission.setImageReference(null);
        ValidationResult result = validation.validateSubmission(submission);
        assertThat(result.getErrors()).anyMatch(e -> e.startsWith("[POLICY]"));
    }

    // ------------------------------------------------------------------
    // Approval → pending EXTERNAL registry entry
    // ------------------------------------------------------------------

    @Test
    void approvalRegistersPendingExternalEntry() throws Exception {
        PluginSubmissionRepository repository = mock(PluginSubmissionRepository.class);
        PluginRegistry registry = mock(PluginRegistry.class);
        PluginSubmissionService service = new PluginSubmissionService();
        ReflectionTestUtils.setField(service, "submissionRepository", repository);
        ReflectionTestUtils.setField(service, "pluginRegistry", registry);

        PluginSubmission submission = imageSubmission();
        submission.setSubmissionId("sub-1");
        submission.setStatus(SubmissionStatus.IN_REVIEW);
        when(repository.findById("sub-1")).thenReturn(java.util.Optional.of(submission));
        when(repository.save(any(PluginSubmission.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateSubmissionStatus("sub-1", SubmissionStatus.APPROVED, "looks good");

        verify(registry).registerExternalSubmission(argThat(s ->
            "Acme Notifier".equals(s.getPluginName())
                && "ghcr.io/acme/notifier".equals(s.getImageReference())));
    }

    // ------------------------------------------------------------------
    // Mechanical in-process refusal
    // ------------------------------------------------------------------

    @Test
    void nonFirstPartyOriginIsRefusedInProcess() throws Exception {
        PluginManager manager = newManager();
        Plugin plugin = mock(Plugin.class);
        when(plugin.getInfo()).thenReturn(new PluginInfo(
            "evil", "1.0.0", "d", "a", PluginType.INTERNAL, PluginRuntime.JAR));

        assertThatThrownBy(() -> manager.installRemotePlugin(
                plugin, "https://evil.example/plugin.jar", Map.of()))
            .isInstanceOf(PluginException.class)
            .hasMessageContaining("EXTERNAL workloads")
            .hasMessageContaining("#395");
        // Refused before any lifecycle call could run third-party code.
        verify(plugin, never()).initialize(any());
        verify(plugin, never()).start();
    }

    @Test
    void firstPartyOriginPassesThePolicyGate() throws Exception {
        PluginManager manager = newManager();
        Plugin plugin = mock(Plugin.class);
        when(plugin.getInfo()).thenReturn(new PluginInfo(
            "official", "1.0.0", "d", "Modulo", PluginType.INTERNAL, PluginRuntime.JAR));
        when(plugin.getCapabilities()).thenReturn(List.of("cap"));
        when(plugin.getRequiredPermissions()).thenReturn(List.of());
        when(plugin.getSubscribedEvents()).thenReturn(List.of());

        String id = manager.installRemotePlugin(
            plugin, "https://github.com/Ikey168/Modulo/releases/plugin.jar", Map.of());

        assertThat(id).isEqualTo("official");
        verify(plugin).start();
    }

    private PluginManager newManager() {
        PluginManager manager = new PluginManager();
        ReflectionTestUtils.setField(manager, "pluginRegistry", mock(PluginRegistry.class));
        ReflectionTestUtils.setField(manager, "pluginLoader", mock(PluginLoader.class));
        ReflectionTestUtils.setField(manager, "securityManager", new PluginSecurityManager());
        ReflectionTestUtils.setField(manager, "eventBus", new PluginEventBus());
        ReflectionTestUtils.setField(manager, "firstPartyOrigins", "https://github.com/Ikey168/Modulo");
        return manager;
    }
}

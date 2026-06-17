package com.modulo.plugin;

import com.modulo.plugin.api.SearchCriteria;
import com.modulo.plugin.api.renderer.RendererEventResponse;
import com.modulo.plugin.submission.ValidationResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Plugin DTO/Value Object Tests")
class PluginDtoTest {

    @Test
    void validationResultTracksErrorsAndWarnings() {
        ValidationResult result = new ValidationResult();
        assertThat(result.isValid()).isTrue();
        assertThat(result.hasIssues()).isFalse();

        result.addWarning("minor");
        assertThat(result.isValid()).isTrue();
        assertThat(result.hasIssues()).isTrue();
        assertThat(result.getWarnings()).contains("minor");

        result.addError("major");
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("major");

        result.setSecurityCheckPassed(true);
        result.setCompatibilityCheckPassed(false);
        assertThat(result.isSecurityCheckPassed()).isTrue();
        assertThat(result.isCompatibilityCheckPassed()).isFalse();
    }

    @Test
    void rendererEventResponseFactories() {
        assertThat(RendererEventResponse.none().getType()).isNotNull();
        assertThat(RendererEventResponse.refreshView().getType()).isNotNull();
        assertThat(RendererEventResponse.navigate("/target").getNavigationTarget()).isEqualTo("/target");
        assertThat(RendererEventResponse.message("hi").getMessage()).isEqualTo("hi");

        RendererEventResponse update = RendererEventResponse.updateNote(Map.of("k", "v"));
        assertThat(update.getData()).containsEntry("k", "v");
        assertThat(update.getData("k")).isEqualTo("v");
    }

    @Test
    void searchCriteriaAccessors() {
        SearchCriteria c = new SearchCriteria("query");
        assertThat(c.getQuery()).isEqualTo("query");

        c.setUserId(7L);
        c.setTags(List.of("a", "b"));
        assertThat(c.getUserId()).isEqualTo(7L);
        assertThat(c.getTags()).containsExactly("a", "b");
    }
}

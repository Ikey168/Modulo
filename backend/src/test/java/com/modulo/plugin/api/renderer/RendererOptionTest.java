package com.modulo.plugin.api.renderer;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Renderer Option Tests")
class RendererOptionTest {

    @Test
    void builderPopulatesSelectOption() {
        RendererOption option = new RendererOption.Builder("theme", RendererOption.OptionType.SELECT)
                .displayName("Theme")
                .description("Visual theme")
                .defaultValue("default")
                .allowedValues("default", "dark", "light")
                .required(true)
                .build();

        assertThat(option.getName()).isEqualTo("theme");
        assertThat(option.getDisplayName()).isEqualTo("Theme");
        assertThat(option.getDescription()).isEqualTo("Visual theme");
        assertThat(option.getType()).isEqualTo(RendererOption.OptionType.SELECT);
        assertThat(option.getDefaultValue()).isEqualTo("default");
        assertThat(option.getAllowedValues()).containsExactly("default", "dark", "light");
        assertThat(option.isRequired()).isTrue();
    }

    @Test
    void builderPopulatesRangeOption() {
        RendererOption option = new RendererOption.Builder("fontSize", RendererOption.OptionType.INTEGER)
                .defaultValue(14)
                .range(8, 72)
                .build();

        assertThat(option.getType()).isEqualTo(RendererOption.OptionType.INTEGER);
        assertThat(option.getDefaultValue()).isEqualTo(14);
        assertThat(option.getMinValue()).isEqualTo(8);
        assertThat(option.getMaxValue()).isEqualTo(72);
        assertThat(option.isRequired()).isFalse();
    }
}

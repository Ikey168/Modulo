package com.modulo.blueprint;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("BlueprintRepository.parseExecutedNodes")
class BlueprintRepositoryTest {

    @Test
    void extractsNodeIdsFromSuccessMessage() {
        String msg = "Executed 3 step(s) [run=abc-123] [nodes=n1,n2,n3]";
        assertThat(BlueprintRepository.parseExecutedNodes(msg)).containsExactly("n1", "n2", "n3");
    }

    @Test
    void trimsWhitespaceAndDropsEmptyEntries() {
        assertThat(BlueprintRepository.parseExecutedNodes("[nodes= a , b ,, c ]"))
            .containsExactly("a", "b", "c");
    }

    @Test
    void returnsEmptyWhenNoNodesToken() {
        assertThat(BlueprintRepository.parseExecutedNodes("Loop guard: too many steps")).isEmpty();
        assertThat(BlueprintRepository.parseExecutedNodes(null)).isEmpty();
        assertThat(BlueprintRepository.parseExecutedNodes("[nodes=]")).isEmpty();
    }

    @Test
    void returnsEmptyForMalformedToken() {
        assertThat(BlueprintRepository.parseExecutedNodes("[nodes=n1,n2")).isEmpty();
    }

    @Test
    void parseResultIsTheExactPathTheInterpreterWrites() {
        // Mirrors the message format produced by BlueprintInterpreterService.
        List<String> executed = List.of("trigger1", "action1", "action2");
        String message = "Executed 2 step(s) [run=xyz] [nodes=" + String.join(",", executed) + "]";
        assertThat(BlueprintRepository.parseExecutedNodes(message)).isEqualTo(executed);
    }
}

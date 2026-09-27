package com.modulo.blueprint.interpreter;

import java.util.Map;

/** Output pin values of one executed node and the exec-out pin to follow next. */
record NodeResult(Map<String, Object> outputs, String nextExecOut, boolean skipped) {
    NodeResult(Map<String, Object> outputs, String nextExecOut) {
        this(outputs, nextExecOut, false);
    }
}

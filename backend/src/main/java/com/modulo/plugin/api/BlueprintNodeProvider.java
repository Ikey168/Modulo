package com.modulo.plugin.api;

import com.modulo.blueprint.BlueprintNodeRegistration;
import java.util.Collection;

/**
 * Optional plugin capability for registering executable blueprint nodes.
 *
 * <p>Plugins that only add views or renderers do not need to implement this
 * interface. External plugins will need an equivalent host protocol before
 * they can contribute executable nodes.
 */
public interface BlueprintNodeProvider {
  Collection<BlueprintNodeRegistration> getBlueprintNodes();
}

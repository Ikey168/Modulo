import type { PluginModule } from '../types';

// State-only companion namespace. Keeping write requests separate lets the Pi
// agent have a narrow, independently revocable write-back grant.
const plugin: PluginModule = { activate() {} };
export default plugin;

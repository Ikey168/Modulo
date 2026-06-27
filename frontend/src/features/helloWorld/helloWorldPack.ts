import type { FeaturePack, ModuloCoreAPI } from '@modulo/core';

let _api: ModuloCoreAPI | null = null;

export const helloWorldPack: FeaturePack = {
  id: 'com.modulo.hello-world',
  name: 'Hello World',
  version: '0.1.0',
  capabilities: [],

  async onMount(api: ModuloCoreAPI) {
    _api = api;
    if (import.meta.env.DEV) {
      console.debug('[hello-world] mounted — ModuloCoreAPI ready', api);
    }
  },

  async onUnmount() {
    _api = null;
    if (import.meta.env.DEV) {
      console.debug('[hello-world] unmounted');
    }
  },
};

/** Exposed so tests and dev tooling can inspect the mounted api reference. */
export function getHelloWorldApi(): ModuloCoreAPI | null {
  return _api;
}

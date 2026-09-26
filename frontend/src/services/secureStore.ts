import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Credential storage. On Android it is the Keystore-backed ModuloSecureStore
 * plugin; the browser and Electron never persist refresh tokens, so there it
 * stores nothing.
 */
export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface NativeSecureStore {
  get(options: { key: string }): Promise<{ value?: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
  clear(): Promise<void>;
}

const native = registerPlugin<NativeSecureStore>('ModuloSecureStore');

export const nativeSecureStore: SecureStore = {
  // org.json drops null members, so a missing key can arrive as undefined.
  get: async key => (await native.get({ key })).value ?? null,
  set: (key, value) => native.set({ key, value }),
  remove: key => native.remove({ key }),
  clear: () => native.clear(),
};

const none: SecureStore = { get: async () => null, set: async () => {}, remove: async () => {}, clear: async () => {} };

export function secureStore(): SecureStore {
  return Capacitor.getPlatform() === 'android' ? nativeSecureStore : none;
}

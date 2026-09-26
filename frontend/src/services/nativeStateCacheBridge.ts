import { registerPlugin } from '@capacitor/core';

export interface NativeStateCacheBridge {
  replica(): Promise<{ replica: string }>;
  server(): Promise<{ origin: string | null }>;
  setServer(options: { origin: string }): Promise<void>;
  clearServer(): Promise<void>;
  load(options: { partition: string }): Promise<{ snapshot: string | null }>;
  save(options: { partition: string; snapshot: string }): Promise<void>;
}

export const nativeStateCache = registerPlugin<NativeStateCacheBridge>('ModuloStateCache');

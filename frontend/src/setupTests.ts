import 'fake-indexeddb/auto';
// Vitest global setup.
// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass,
// toHaveAttribute, etc.) and cleans up the DOM between tests.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Each test starts with an empty device database and fresh device/recovery stores.
import { beforeEach as resetDeviceStorage } from 'vitest';
import { IDBFactory as FreshIDBFactory } from 'fake-indexeddb';
import { setDeviceDocuments } from './services/deviceDocuments';
import { setLegacyRecoveryStore } from './services/legacy/legacyRecovery';
resetDeviceStorage(() => {
  globalThis.indexedDB = new FreshIDBFactory();
  setDeviceDocuments(undefined);
  setLegacyRecoveryStore(undefined);
});

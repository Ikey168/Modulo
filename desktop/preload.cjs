'use strict';

/**
 * Preload script for the Modulo desktop shell.
 *
 * Runs with contextIsolation + sandbox enabled and exposes a deliberately
 * tiny, read-only surface. The renderer is the unmodified web frontend; it
 * only needs to know it is running inside the desktop shell (see
 * frontend/src/services/desktop.ts). Grow this surface via contextBridge +
 * ipcRenderer.invoke as desktop-only features appear — never enable
 * nodeIntegration instead.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('moduloDesktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});

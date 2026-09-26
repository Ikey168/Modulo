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

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('moduloDesktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  credentials: {
    status: () => ipcRenderer.invoke('desktop:credentials:status'),
    set: (key, value) => ipcRenderer.invoke('desktop:credentials:set', key, value),
  },
  providers: {
    search: (provider, query) => ipcRenderer.invoke('desktop:provider:search', provider, query),
  },
  feeds: { sync: (options) => ipcRenderer.invoke('desktop:feeds:sync', options) },
  archive: {
    capture: (url) => ipcRenderer.invoke('desktop:archive:capture', url),
    import: (options) => ipcRenderer.invoke('desktop:archive:import', options),
    open: (path) => ipcRenderer.invoke('desktop:archive:open', path),
  },
  webWatch: {
    sync: (items) => ipcRenderer.invoke('desktop:webwatch:sync', items),
    check: (ids) => ipcRenderer.invoke('desktop:webwatch:check', ids),
    onChanged: (listener) => { const handler = (_event, value) => listener(value); ipcRenderer.on('desktop:webwatch:changed', handler); return () => ipcRenderer.removeListener('desktop:webwatch:changed', handler); },
  },
  documents: {
    import: () => ipcRenderer.invoke('desktop:documents:import'),
    open: (path) => ipcRenderer.invoke('desktop:documents:open', path),
  },
  pdf: {
    choose: () => ipcRenderer.invoke('desktop:pdf:choose'),
    run: (operation, files) => ipcRenderer.invoke('desktop:pdf:run', operation, files),
  },
  managedFiles: {
    chooseRoot: () => ipcRenderer.invoke('desktop:files:choose-root'),
    index: (root) => ipcRenderer.invoke('desktop:files:index', root),
    open: (path) => ipcRenderer.invoke('desktop:files:open', path),
  },
  caldav: { sync: (url) => ipcRenderer.invoke('desktop:caldav:sync', url) },
  ntfy: { publish: (options) => ipcRenderer.invoke('desktop:ntfy:publish', options) },
  attachments: {
    choose: () => ipcRenderer.invoke('desktop:attachments:choose'),
    list: () => ipcRenderer.invoke('desktop:attachments:list'),
    open: (path) => ipcRenderer.invoke('desktop:attachments:open', path),
    remove: (path) => ipcRenderer.invoke('desktop:attachments:remove', path),
    onChanged: (listener) => { const handler = (_event, value) => listener(value); ipcRenderer.on('desktop:attachments:changed', handler); return () => ipcRenderer.removeListener('desktop:attachments:changed', handler); },
  },
  reminders: {
    sync: (items) => ipcRenderer.invoke('desktop:reminders:sync', items),
    action: (id, action) => ipcRenderer.invoke('desktop:reminders:action', id, action),
    onAction: (listener) => { const handler = (_event, value) => listener(value); ipcRenderer.on('desktop:reminder-action', handler); return () => ipcRenderer.removeListener('desktop:reminder-action', handler); },
  },
  backup: {
    exportZip: (payload) => ipcRenderer.invoke('desktop:backup:export', payload),
    importZip: () => ipcRenderer.invoke('desktop:backup:import'),
  },
  sync: {
    chooseDirectory: () => ipcRenderer.invoke('desktop:sync:choose-directory'),
    status: () => ipcRenderer.invoke('desktop:sync:status'),
    write: (payload, passphrase) => ipcRenderer.invoke('desktop:sync:write', payload, passphrase),
    read: (passphrase) => ipcRenderer.invoke('desktop:sync:read', passphrase),
  },
});

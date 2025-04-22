"use strict";
const electron = require("electron");
const electronAPI = {
  // File System
  selectDirectory: () => electron.ipcRenderer.invoke("dialog:selectDirectory"),
  readDirectory: (path) => electron.ipcRenderer.invoke("fs:readDirectory", path),
  readFileContent: (filePath) => electron.ipcRenderer.invoke("fs:readFileContent", filePath),
  saveFile: (filePath, content) => electron.ipcRenderer.invoke("dialog:saveFile", filePath, content),
  saveFileAs: (content) => electron.ipcRenderer.invoke("dialog:saveFileAs", content),
  createFile: (filePath) => electron.ipcRenderer.invoke("fs:createFile", filePath),
  createDirectory: (dirPath) => electron.ipcRenderer.invoke("fs:createDirectory", dirPath),
  renameItem: (oldPath, newName) => electron.ipcRenderer.invoke("fs:renameItem", oldPath, newName),
  deleteItem: (itemPath) => electron.ipcRenderer.invoke("fs:deleteItem", itemPath),
  openFile: () => electron.ipcRenderer.invoke("dialog:openFile"),
  fileExists: (filePath) => electron.ipcRenderer.invoke("fs:fileExists", filePath),
  // App Control / Events
  onTriggerNewFile: (callback) => {
    electron.ipcRenderer.on("trigger-new-file", callback);
    return () => electron.ipcRenderer.removeListener("trigger-new-file", callback);
  },
  onTriggerOpenFile: (callback) => {
    electron.ipcRenderer.on("trigger-open-file", callback);
    return () => electron.ipcRenderer.removeListener("trigger-open-file", callback);
  },
  onTriggerSelectFolder: (callback) => {
    electron.ipcRenderer.on("trigger-select-folder", callback);
    return () => electron.ipcRenderer.removeListener("trigger-select-folder", callback);
  },
  onTriggerSaveFile: (callback) => {
    electron.ipcRenderer.on("trigger-save-file", callback);
    return () => electron.ipcRenderer.removeListener("trigger-save-file", callback);
  },
  onTriggerSaveAs: (callback) => {
    electron.ipcRenderer.on("trigger-save-as", callback);
    return () => electron.ipcRenderer.removeListener("trigger-save-as", callback);
  },
  onTriggerCloseFolder: (callback) => {
    electron.ipcRenderer.on("trigger-close-folder", callback);
    return () => electron.ipcRenderer.removeListener("trigger-close-folder", callback);
  },
  onTriggerCommandPalette: (callback) => {
    electron.ipcRenderer.on("trigger-command-palette", callback);
    return () => electron.ipcRenderer.removeListener("trigger-command-palette", callback);
  },
  onTriggerSearchFiles: (callback) => {
    electron.ipcRenderer.on("trigger-search-files", callback);
    return () => electron.ipcRenderer.removeListener("trigger-search-files", callback);
  },
  onMainProcessMessage: (callback) => {
    electron.ipcRenderer.on("main-process-message", (_event, message) => callback(message));
  },
  // Add implementation for onTriggerRunFile
  onTriggerRunFile: (callback) => {
    electron.ipcRenderer.on("trigger-run-file", callback);
    return () => electron.ipcRenderer.removeListener("trigger-run-file", callback);
  },
  // Zoom Control
  zoomIn: () => electron.ipcRenderer.invoke("app:zoom-in"),
  zoomOut: () => electron.ipcRenderer.invoke("app:zoom-out"),
  zoomReset: () => electron.ipcRenderer.invoke("app:zoom-reset"),
  onZoomUpdate: (callback) => {
    const listener = (_event, zoomFactor) => callback(zoomFactor);
    electron.ipcRenderer.on("zoom-updated", listener);
  },
  // Search Functionality
  searchInFiles: (rootPath, searchText, includePattern, excludePattern) => electron.ipcRenderer.invoke("search:inFiles", rootPath, searchText, includePattern, excludePattern),
  // --- Terminal --- //
  ptySpawn: (options) => electron.ipcRenderer.invoke("pty:spawn", options),
  ptyWrite: (ptyId, data) => electron.ipcRenderer.send("pty:write", ptyId, data),
  ptyResize: (ptyId, cols, rows) => electron.ipcRenderer.send("pty:resize", ptyId, cols, rows),
  ptyKill: (ptyId) => electron.ipcRenderer.send("pty:kill", ptyId),
  onPtyData: (ptyId, callback) => {
    const channel = `pty:data:${ptyId}`;
    const listener = (_event, data) => callback(data);
    electron.ipcRenderer.on(channel, listener);
    return () => electron.ipcRenderer.removeListener(channel, listener);
  },
  onPtyExit: (ptyId, callback) => {
    const channel = `pty:exit:${ptyId}`;
    const listener = (_event, exitInfo) => callback(exitInfo);
    electron.ipcRenderer.on(channel, listener);
    return () => electron.ipcRenderer.removeListener(channel, listener);
  },
  // --- OS Info Implementation --- //
  getPlatform: () => electron.ipcRenderer.invoke("app:get-platform"),
  // Terminal Error Listener Implementation
  onPtyError: (ptyId, callback) => {
    const channel = `pty:error:${ptyId}`;
    const listener = (_event, errorMessage) => callback(errorMessage);
    electron.ipcRenderer.on(channel, listener);
    return () => electron.ipcRenderer.removeListener(channel, listener);
  },
  // --- Live Preview Implementation --- //
  startFilePreview: (filePath) => electron.ipcRenderer.invoke("preview:startServer", filePath),
  stopFilePreview: () => electron.ipcRenderer.invoke("preview:stopServer"),
  onTriggerPreviewFile: (callback) => {
    electron.ipcRenderer.on("trigger-preview-file", callback);
    return () => electron.ipcRenderer.removeListener("trigger-preview-file", callback);
  },
  // --- Run Project Implementation --- //
  onTriggerRunProject: (callback) => {
    electron.ipcRenderer.on("trigger-run-project", callback);
    return () => electron.ipcRenderer.removeListener("trigger-run-project", callback);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);

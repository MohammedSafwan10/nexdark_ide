import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Define the structure of the API we're exposing
export interface ElectronAPI {
  // File System Operations
  selectDirectory: () => Promise<{ canceled: boolean; path?: string }>
  readDirectory: (path: string) => Promise<{ name: string; isDirectory: boolean }[] | { error: string }>
  readFileContent: (filePath: string) => Promise<{ content?: string; error?: string }>
  saveFile: (filePath: string | null, content: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
  saveFileAs: (content: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
  createFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>
  renameItem: (oldPath: string, newName: string) => Promise<{ success: boolean; error?: string }>
  deleteItem: (itemPath: string) => Promise<{ success: boolean; error?: string }>
  openFile: () => Promise<{ filePath?: string; content?: string; error?: string; canceled?: boolean }>
  fileExists: (filePath: string) => Promise<boolean>;

  // App Control / Events
  onTriggerNewFile: (callback: () => void) => void
  onTriggerOpenFile: (callback: () => void) => void
  onTriggerSelectFolder: (callback: () => void) => void
  onTriggerSaveFile: (callback: () => void) => void
  onTriggerSaveAs: (callback: () => void) => void
  onTriggerCloseFolder: (callback: () => void) => void
  onMainProcessMessage: (callback: (message: string) => void) => void
  // Add Command Palette & Search triggers
  onTriggerCommandPalette: (callback: () => void) => (() => void)
  onTriggerSearchFiles: (callback: () => void) => (() => void)
  // Zoom Control
  zoomIn: () => Promise<void>
  zoomOut: () => Promise<void>
  zoomReset: () => Promise<void>
  onZoomUpdate: (callback: (zoomFactor: number) => void) => void
  // Search Functionality
  searchInFiles: (rootPath: string, searchText: string, includePattern?: string, excludePattern?: string) => Promise<Array<{ 
    filePath: string; 
    matches: Array<{ 
      line: number; 
      lineContent: string; 
      startColumn: number; 
      endColumn: number 
    }> 
  }>>
  
  // --- Run Command --- //
  onTriggerRunFile: (callback: () => void) => (() => void)
  
  // --- Terminal (node-pty) --- //
  ptySpawn: (options: { cols: number, rows: number, cwd?: string }) => Promise<{ ptyId?: number; error?: string }>;
  ptyWrite: (ptyId: number, data: string) => void;
  ptyResize: (ptyId: number, cols: number, rows: number) => void;
  ptyKill: (ptyId: number) => void;
  onPtyData: (ptyId: number, callback: (data: string) => void) => (() => void); // Returns cleanup function
  onPtyExit: (ptyId: number, callback: (exitInfo: { exitCode: number, signal?: number }) => void) => (() => void); // Returns cleanup function

  // --- OS Info --- //
  getPlatform: () => Promise<string>; // Add function to get OS platform

  // Terminal Error Listener
  onPtyError: (ptyId: number, callback: (errorMessage: string) => void) => (() => void);
  
  // --- Live Preview --- //
  startFilePreview: (filePath: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  stopFilePreview: () => Promise<{ success: boolean }>;
  onTriggerPreviewFile: (callback: () => void) => (() => void);
  // --- Run Project --- //
  onTriggerRunProject: (callback: () => void) => (() => void);
}

// Expose methods and listeners to the renderer process
const electronAPI: ElectronAPI = {
  // File System
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  readDirectory: (path) => ipcRenderer.invoke('fs:readDirectory', path),
  readFileContent: (filePath) => ipcRenderer.invoke('fs:readFileContent', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('dialog:saveFile', filePath, content),
  saveFileAs: (content) => ipcRenderer.invoke('dialog:saveFileAs', content),
  createFile: (filePath) => ipcRenderer.invoke('fs:createFile', filePath),
  createDirectory: (dirPath) => ipcRenderer.invoke('fs:createDirectory', dirPath),
  renameItem: (oldPath, newName) => ipcRenderer.invoke('fs:renameItem', oldPath, newName),
  deleteItem: (itemPath) => ipcRenderer.invoke('fs:deleteItem', itemPath),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),

  // App Control / Events
  onTriggerNewFile: (callback) => {
    ipcRenderer.on('trigger-new-file', callback)
    // Return cleanup function
    return () => ipcRenderer.removeListener('trigger-new-file', callback)
  },
  onTriggerOpenFile: (callback) => {
    ipcRenderer.on('trigger-open-file', callback)
    // Return cleanup function
    return () => ipcRenderer.removeListener('trigger-open-file', callback)
  },
  onTriggerSelectFolder: (callback) => {
    ipcRenderer.on('trigger-select-folder', callback)
    // Return cleanup function
    return () => ipcRenderer.removeListener('trigger-select-folder', callback)
  },
  onTriggerSaveFile: (callback) => {
    ipcRenderer.on('trigger-save-file', callback)
    // Return cleanup function
    return () => ipcRenderer.removeListener('trigger-save-file', callback)
  },
  onTriggerSaveAs: (callback) => {
    ipcRenderer.on('trigger-save-as', callback)
    // Return cleanup function
    return () => ipcRenderer.removeListener('trigger-save-as', callback)
  },
  onTriggerCloseFolder: (callback) => {
    ipcRenderer.on('trigger-close-folder', callback)
    // Return cleanup function
    return () => ipcRenderer.removeListener('trigger-close-folder', callback)
  },
  onTriggerCommandPalette: (callback) => {
    ipcRenderer.on('trigger-command-palette', callback)
    return () => ipcRenderer.removeListener('trigger-command-palette', callback)
  },
  onTriggerSearchFiles: (callback) => {
    ipcRenderer.on('trigger-search-files', callback)
    return () => ipcRenderer.removeListener('trigger-search-files', callback)
  },
  onMainProcessMessage: (callback) => {
    // Deliberately strip event as it includes `sender` 
    ipcRenderer.on('main-process-message', (_event, message) => callback(message))
  },
  // Add implementation for onTriggerRunFile
  onTriggerRunFile: (callback) => {
    ipcRenderer.on('trigger-run-file', callback);
    return () => ipcRenderer.removeListener('trigger-run-file', callback);
  },
  // Zoom Control
  zoomIn: () => ipcRenderer.invoke('app:zoom-in'),
  zoomOut: () => ipcRenderer.invoke('app:zoom-out'),
  zoomReset: () => ipcRenderer.invoke('app:zoom-reset'),
  onZoomUpdate: (callback) => {
    const listener = (_event: IpcRendererEvent, zoomFactor: number) => callback(zoomFactor)
    ipcRenderer.on('zoom-updated', listener)
    // Optional: Return a cleanup function to remove the listener
    // return () => ipcRenderer.removeListener('zoom-updated', listener)
  },
  // Search Functionality
  searchInFiles: (rootPath, searchText, includePattern, excludePattern) => 
    ipcRenderer.invoke('search:inFiles', rootPath, searchText, includePattern, excludePattern),

  // --- Terminal --- //
  ptySpawn: (options) => ipcRenderer.invoke('pty:spawn', options),
  ptyWrite: (ptyId, data) => ipcRenderer.send('pty:write', ptyId, data),
  ptyResize: (ptyId, cols, rows) => ipcRenderer.send('pty:resize', ptyId, cols, rows),
  ptyKill: (ptyId) => ipcRenderer.send('pty:kill', ptyId),
  onPtyData: (ptyId, callback) => {
    const channel = `pty:data:${ptyId}`;
    const listener = (_event: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on(channel, listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onPtyExit: (ptyId, callback) => {
    const channel = `pty:exit:${ptyId}`;
    const listener = (_event: IpcRendererEvent, exitInfo: { exitCode: number, signal?: number }) => callback(exitInfo);
    ipcRenderer.on(channel, listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // --- OS Info Implementation --- //
  getPlatform: () => ipcRenderer.invoke('app:get-platform'),

  // Terminal Error Listener Implementation
  onPtyError: (ptyId, callback) => {
      const channel = `pty:error:${ptyId}`;
      const listener = (_event: IpcRendererEvent, errorMessage: string) => callback(errorMessage);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
  },
  
  // --- Live Preview Implementation --- //
  startFilePreview: (filePath) => ipcRenderer.invoke('preview:startServer', filePath),
  stopFilePreview: () => ipcRenderer.invoke('preview:stopServer'),
  onTriggerPreviewFile: (callback) => {
    ipcRenderer.on('trigger-preview-file', callback);
    return () => ipcRenderer.removeListener('trigger-preview-file', callback);
  },
  // --- Run Project Implementation --- //
  onTriggerRunProject: (callback) => {
    ipcRenderer.on('trigger-run-project', callback);
    return () => ipcRenderer.removeListener('trigger-run-project', callback);
  },
}

// Expose the API to the window object
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Optional: Expose ipcRenderer.on for specific channels safely
// contextBridge.exposeInMainWorld('ipcRenderer', {
//   on: (channel: string, func: (...args: any[]) => void) => {
//     if (validReceiveChannels.includes(channel)) {
//       // Deliberately strip event as it includes `sender`
//       ipcRenderer.on(channel, (event, ...args) => func(...args))
//     } else {
//       console.error(`Invalid channel received in preload: ${channel}`)
//     }
//   },
//   // You might need removeListener as well
//   removeListener: (channel: string, func: (...args: any[]) => void) => {
//     if (validReceiveChannels.includes(channel)) {
//       ipcRenderer.removeListener(channel, func)
//     }
//   }
// })
import type * as monaco from 'monaco-editor';

// Define the API structure we'll expose
// Make sure this matches the implementation in preload.ts
export interface IElectronAPI {
  openFile: () => Promise<{ filePath?: string; content?: string; error?: string; canceled?: boolean }>;
  saveFile: (filePath: string | null, content: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  saveFileAs: (content: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  handleMainMessage: (callback: (event: Electron.IpcRendererEvent, message: string) => void) => () => void; // Return cleanup function
  // Add listener method signatures
  onTriggerNewFile: (callback: () => void) => (() => void);
  onTriggerOpenFile: (callback: () => void) => (() => void);
  onTriggerSaveFile: (callback: () => void) => (() => void);
  onTriggerSaveAs: (callback: () => void) => (() => void);
  onTriggerSelectFolder: (callback: () => void) => (() => void);
  onTriggerCloseFolder: (callback: () => void) => (() => void);
  // Add Command Palette & Search triggers
  onTriggerCommandPalette: (callback: () => void) => (() => void);
  onTriggerSearchFiles: (callback: () => void) => (() => void);
  // Add directory handling methods
  selectDirectory: () => Promise<{ canceled: boolean; path?: string }>;
  readDirectory: (dirPath: string) => Promise<{ name: string; isDirectory: boolean }[] | { error: string }>;
  // Add file content reader method
  readFileContent: (filePath: string) => Promise<{ content?: string; error?: string }>;
  // Add file/directory creation methods
  createFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  // Add rename/delete methods
  renameItem: (oldPath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  deleteItem: (itemPath: string) => Promise<{ success: boolean; error?: string }>;
  // App Control / Events
  onMainProcessMessage: (callback: (message: string) => void) => void;
  // Zoom Control
  zoomIn: () => Promise<void>;
  zoomOut: () => Promise<void>;
  zoomReset: () => Promise<void>;
  onZoomUpdate: (callback: (zoomFactor: number) => void) => void;
  // Search Functionality
  searchInFiles: (rootPath: string, searchText: string, includePattern?: string, excludePattern?: string) => Promise<SearchResult[]>;

  // --- Run Command --- //
  onTriggerRunFile: (callback: () => void) => (() => void); // Add listener for run command

  // --- Terminal (node-pty) --- //
  ptySpawn: (options: { cols: number, rows: number, cwd?: string }) => Promise<{ ptyId?: number; error?: string }>;
  ptyWrite: (ptyId: number, data: string) => void;
  ptyResize: (ptyId: number, cols: number, rows: number) => void;
  ptyKill: (ptyId: number) => void;
  onPtyData: (ptyId: number, callback: (data: string) => void) => (() => void); // Returns cleanup function
  onPtyExit: (ptyId: number, callback: (exitInfo: { exitCode: number, signal?: number }) => void) => (() => void); // Returns cleanup function

  // --- OS Info --- //
  getPlatform: () => Promise<string>; // Add definition for platform check
  
  // --- Terminal Error Listener --- //
  onPtyError: (ptyId: number, callback: (errorMessage: string) => void) => (() => void);

  // --- Live Preview --- //
  startFilePreview: (filePath: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  stopFilePreview: () => Promise<{ success: boolean }>;
  onTriggerPreviewFile: (callback: () => void) => (() => void); // Add listener definition
  // --- Run Project --- //
  onTriggerRunProject: (callback: () => void) => (() => void); // Add listener definition

  // --- File Exists --- //
  fileExists: (filePath: string) => Promise<boolean>; // Add definition
}

// Add type for Tab information
export interface TabInfo {
  id: string; // Unique identifier (filePath or generated for untitled)
  path: string | null; // Full path, null if untitled
  title: string; // Display name (filename or 'Untitled')
  content: string; // Current content in the editor (may become less relevant with models)
  savedContent: string; // Content when last saved
  isDirty: boolean;
  language: string;
  viewState?: monaco.editor.ICodeEditorViewState | null;
  model?: monaco.editor.ITextModel | null; // Add model reference
}

// Add type for search results
export interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
}

export interface SearchMatch {
  line: number;
  lineContent: string;
  startColumn: number;
  endColumn: number;
}

// Make the API available on the window object
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
} 
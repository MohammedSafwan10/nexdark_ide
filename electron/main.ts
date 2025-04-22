import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItemConstructorOptions, shell as electronShell } from 'electron'
import fs from 'node:fs/promises'
import fsSync from 'node:fs' // Import sync fs for existsSync
import { Dirent } from 'node:fs' // Import Dirent type
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os' // Needed for shell selection
import http from 'node:http' // Import HTTP module
import pty, { IPty } from 'node-pty' // Import node-pty
import serveHandler from 'serve-handler' // Import serve-handler

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// --- Global Error Handling ---
process.on('uncaughtException', (error, origin) => {
  console.error('!!!!!!!!!!!! UNCAUGHT EXCEPTION !!!!!!!!!!!!');
  console.error('Origin:', origin);
  console.error('Error:', error);
  // In production, you might want to log this to a file or service
  // IMPORTANT: Avoid operations here that might trigger more errors.
  // Optionally, inform the user gracefully if possible, but the app might be unstable.
  // dialog.showErrorBox('Unhandled Error', `An critical error occurred: ${error.message}`);
  // Consider exiting gracefully after logging in some cases, but for debugging, let's prevent exit for now.
  // app.quit(); 
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('!!!!!!!!!!!! UNHANDLED REJECTION !!!!!!!!!!!!');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  // Log or handle appropriately
});
// --- End Global Error Handling ---

let win: BrowserWindow | null
const ptyProcesses = new Map<number, IPty>(); // Store PTY instances mapped by PID

// --- Live Preview Server State ---
let previewServer: http.Server | null = null;
let previewServerPort: number | null = null;
const PREVIEW_DEFAULT_PORT = 5174; // Choose a default port (different from Vite's)
// --- End Live Preview Server State ---

// Determine the shell based on the operating system
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// --- Terminal (node-pty) Integration ---

// Function to get next available PID (simple approach, might need improvement for robustness)
let nextPtyId = 1; 
function getNextPtyId() {
  return nextPtyId++;
}

// --- NOTE: IPC handlers for PTY are moved to app.whenReady --- //

// --- Zoom Control --- //

const ZOOM_STEP = 0.1; // How much to zoom in/out each step

function getZoomFactor(): number {
  return win ? win.webContents.getZoomFactor() : 1.0;
}

function setZoomFactor(factor: number): void {
  if (win) {
    // Clamp zoom factor between reasonable limits (e.g., 50% to 300%)
    const clampedFactor = Math.max(0.5, Math.min(3.0, factor));
    win.webContents.setZoomFactor(clampedFactor);
    // Notify renderer about the zoom change
    win.webContents.send('zoom-updated', clampedFactor);
  }
}

function zoomIn(): void {
  setZoomFactor(getZoomFactor() + ZOOM_STEP);
}

function zoomOut(): void {
  setZoomFactor(getZoomFactor() - ZOOM_STEP);
}

function zoomReset(): void {
  setZoomFactor(1.0);
}

// --- File/Directory Handling --- //
async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'] // Allow selecting files
  })
  if (!canceled && filePaths.length > 0) {
    try {
      const filePath = filePaths[0];
      const content = await fs.readFile(filePath, 'utf-8');
      return { filePath, content }; // Return both path and content
    } catch (error) {
      console.error('Failed to read file:', error);
      return { error: 'Failed to read file' };
    }
  }
  return { canceled: true }; // Indicate cancellation or no selection
}

async function handleFileSave(_event: Electron.IpcMainInvokeEvent, filePath: string | null, content: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  let savePath = filePath;

  // If no filePath provided (new file), show "Save As" dialog
  if (!savePath) {
    const { canceled, filePath: chosenPath } = await dialog.showSaveDialog(win!, {
      title: 'Save File As',
      buttonLabel: 'Save',
      // You can add defaultPath or filters here
      // defaultPath: path.join(app.getPath('documents'), 'untitled.txt'),
      // filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (canceled || !chosenPath) {
      return { success: false }; // User cancelled Save As
    }
    savePath = chosenPath;
  }

  // Try to write the file
  try {
    await fs.writeFile(savePath, content, 'utf-8');
    console.log('File saved:', savePath);
    return { success: true, filePath: savePath }; // Return success and the path used
  } catch (error) {
    console.error('Failed to save file:', error);
    return { success: false, error: 'Failed to save file' };
  }
}

// Prefix unused event parameter with underscore
async function handleReadDirectory(_event: Electron.IpcMainInvokeEvent, dirPath: string): Promise<{ name: string; isDirectory: boolean }[] | { error: string }> {
  try {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    // Map Dirent objects to a simpler structure for the renderer
    const files = dirents.map((dirent: Dirent) => ({
      name: dirent.name,
      isDirectory: dirent.isDirectory(),
    }));
    return files;
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error);
    // Type check the error before accessing properties
    let errorMessage = 'Unknown error reading directory';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { error: `Failed to read directory: ${errorMessage}` };
  }
}

// New handler to select a directory
async function handleSelectDirectory(): Promise<{ canceled: boolean; path?: string }> {
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory']
    });
    if (!canceled && filePaths.length > 0) {
        return { canceled: false, path: filePaths[0] };
    }
    return { canceled: true };
}

// New handler to read file content by path
async function handleReadFileContent(_event: Electron.IpcMainInvokeEvent, filePath: string): Promise<{ content?: string; error?: string }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { content };
    } catch (error) {
      console.error(`Failed to read file content ${filePath}:`, error);
      let errorMessage = 'Unknown error reading file';
      if (error instanceof Error) {
          errorMessage = error.message;
      }
      return { error: `Failed to read file: ${errorMessage}` };
    }
}

// Add a handler specifically for Save As
async function handleFileSaveAs(_event: Electron.IpcMainInvokeEvent, content: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  // Always show the save dialog
  const { canceled, filePath: chosenPath } = await dialog.showSaveDialog(win!, {
    title: 'Save File As',
    buttonLabel: 'Save',
  });

  if (canceled || !chosenPath) {
    return { success: false }; // User cancelled
  }

  // Try to write the file
  try {
    await fs.writeFile(chosenPath, content, 'utf-8');
    console.log('File saved as:', chosenPath);
    return { success: true, filePath: chosenPath };
  } catch (error) {
    console.error('Failed to save file:', error);
    let errorMessage = 'Unknown error saving file';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, error: `Failed to save file: ${errorMessage}` };
  }
}

// NEW: Handle Create File
async function handleCreateFile(_event: Electron.IpcMainInvokeEvent, filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if file already exists
    if (fsSync.existsSync(filePath)) {
      return { success: false, error: 'File already exists at this location.' };
    }
    // Create an empty file
    await fs.writeFile(filePath, '', 'utf-8');
    console.log('File created:', filePath);
    return { success: true };
  } catch (error) {
    console.error('Failed to create file:', error);
    const message = error instanceof Error ? error.message : 'Unknown error creating file';
    return { success: false, error: `Failed to create file: ${message}` };
  }
}

// NEW: Handle Create Directory
async function handleCreateDirectory(_event: Electron.IpcMainInvokeEvent, dirPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if directory already exists
    if (fsSync.existsSync(dirPath)) {
        return { success: false, error: 'Directory already exists at this location.' };
    }
    // Create the directory
    await fs.mkdir(dirPath); // mkdir recursively creates parent directories if needed by default in newer Node.js
    console.log('Directory created:', dirPath);
    return { success: true };
  } catch (error) {
    console.error('Failed to create directory:', error);
    const message = error instanceof Error ? error.message : 'Unknown error creating directory';
    return { success: false, error: `Failed to create directory: ${message}` };
  }
}

// NEW: Handle Rename Item
async function handleRenameItem(_event: Electron.IpcMainInvokeEvent, oldPath: string, newName: string): Promise<{ success: boolean; error?: string }> {
    const newPath = path.join(path.dirname(oldPath), newName);
    try {
        // Check if new path already exists
        if (newPath !== oldPath && fsSync.existsSync(newPath)) {
            return { success: false, error: `An item named '${newName}' already exists.` };
        }
        await fs.rename(oldPath, newPath);
        console.log(`Renamed '${oldPath}' to '${newPath}'`);
        return { success: true };
    } catch (error) {
        console.error(`Failed to rename '${oldPath}' to '${newName}':`, error);
        const message = error instanceof Error ? error.message : 'Unknown error renaming item';
        return { success: false, error: `Failed to rename: ${message}` };
    }
}

// NEW: Handle Delete Item (use recursive force for simplicity, add confirmation later)
async function handleDeleteItem(_event: Electron.IpcMainInvokeEvent, itemPath: string): Promise<{ success: boolean; error?: string }> {
    try {
        // For safety, let's initially block deleting the root directory itself if provided
        // You might want more robust checks later
        // if (itemPath === rootDir) return { success: false, error: "Cannot delete the root directory."};

        // Use rm with recursive and force options (use with caution!)
        await fs.rm(itemPath, { recursive: true, force: true });
        console.log(`Deleted item: '${itemPath}'`);
        return { success: true };
    } catch (error) {
        console.error(`Failed to delete '${itemPath}':`, error);
        const message = error instanceof Error ? error.message : 'Unknown error deleting item';
        return { success: false, error: `Failed to delete: ${message}` };
    }
}

// NEW: Handle Search in Files
async function handleSearchInFiles(
  _event: Electron.IpcMainInvokeEvent, 
  rootPath: string, 
  searchText: string, 
  includePattern?: string, 
  excludePattern?: string
): Promise<Array<{ filePath: string; matches: Array<{ line: number; lineContent: string; startColumn: number; endColumn: number }> }>> {
  console.log(`Searching for "${searchText}" in ${rootPath}`);
  
  if (!searchText.trim()) {
    return []; // Empty search text returns no results
  }
  
  const results: Array<{ 
    filePath: string; 
    matches: Array<{ 
      line: number; 
      lineContent: string; 
      startColumn: number; 
      endColumn: number 
    }> 
  }> = [];
  
  // Function to recursively walk directories and search files
  async function searchDirectory(dirPath: string) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // Process entries in parallel for better performance
      await Promise.all(entries.map(async entry => {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip if excluded pattern matches
        if (excludePattern && new RegExp(excludePattern).test(fullPath)) {
          return;
        }
        
        if (entry.isDirectory()) {
          // Skip node_modules and .git directories by default for performance
          if (entry.name === 'node_modules' || entry.name === '.git') {
            return;
          }
          
          // Recursively search subdirectories
          await searchDirectory(fullPath);
        } else if (entry.isFile()) {
          // Skip if include pattern is specified and doesn't match
          if (includePattern && !new RegExp(includePattern).test(entry.name)) {
            return;
          }
          
          // Skip binary files and very large files
          try {
            const stats = await fs.stat(fullPath);
            if (stats.size > 1024 * 1024) { // Skip files > 1MB 
              return;
            }
            
            // Read file content
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split(/\r?\n/);
            
            const fileMatches: Array<{ 
              line: number; 
              lineContent: string; 
              startColumn: number; 
              endColumn: number 
            }> = [];
            
            // Search for text in each line
            lines.forEach((lineContent, lineIndex) => {
              let match;
              const searchRegex = new RegExp(searchText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
              
              while ((match = searchRegex.exec(lineContent)) !== null) {
                fileMatches.push({
                  line: lineIndex + 1, // 1-based line number
                  lineContent: lineContent,
                  startColumn: match.index + 1, // 1-based column
                  endColumn: match.index + match[0].length + 1
                });
              }
            });
            
            if (fileMatches.length > 0) {
              results.push({
                filePath: fullPath,
                matches: fileMatches
              });
            }
          } catch (error) {
            // Skip files that can't be read (binary files, permissions issues, etc.)
            console.error(`Error reading file ${fullPath}:`, error);
          }
        }
      }));
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
  }
  
  try {
    await searchDirectory(rootPath);
    return results;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// --- End File/Directory Handling --- //

// --- Menu Template --- //
const menuTemplate: MenuItemConstructorOptions[] = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New File',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          // Send message to renderer to trigger new file action
          win?.webContents.send('trigger-new-file');
        }
      },
      {
        label: 'Open File...',
        accelerator: 'CmdOrCtrl+O',
        click: () => {
          // Send message to renderer to trigger open file action
          win?.webContents.send('trigger-open-file');
        }
      },
      {
        label: 'Open Project Folder...',
        click: () => {
          console.log("[main.ts] Menu item 'Open Project Folder...' clicked. Sending trigger-select-folder.");
          win?.webContents.send('trigger-select-folder');
        }
      },
      { type: 'separator' },
      {
        label: 'Save', // Changed label for clarity
        accelerator: 'CmdOrCtrl+S',
        click: () => {
          // Send message to renderer to trigger save file action
          win?.webContents.send('trigger-save-file');
        }
      },
      {
        label: 'Save As...',
        accelerator: 'Shift+CmdOrCtrl+S',
        click: () => { win?.webContents.send('trigger-save-as'); } // New trigger
      },
      { type: 'separator' },
      {
        label: 'Close Project Folder',
        // Add accelerator if desired
        click: () => { win?.webContents.send('trigger-close-folder'); }
      },
      { type: 'separator' },
      { role: 'quit' } // Standard Quit item
    ]
  },
  // Add other menus like Edit, View, Window, Help as needed
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' }, // Useful for debugging
      { type: 'separator' },
      {
        label: 'Command Palette...',
        accelerator: 'CmdOrCtrl+Shift+P',
        click: () => { win?.webContents.send('trigger-command-palette'); }
      },
      {
        label: 'Zoom In',
        accelerator: 'CmdOrCtrl+=', // Use = for + key
        click: zoomIn
      },
      {
        label: 'Zoom Out',
        accelerator: 'CmdOrCtrl+-',
        click: zoomOut
      },
      {
        label: 'Reset Zoom',
        accelerator: 'CmdOrCtrl+0',
        click: zoomReset
      },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
    label: 'Search',
    submenu: [
      {
        label: 'Find in Files',
        accelerator: 'CmdOrCtrl+Shift+F',
        click: () => { win?.webContents.send('trigger-search-files'); }
      }
    ]
  },
  {
    label: 'Run',
    submenu: [
      {
        label: 'Run Project', // New menu item
        // Add accelerator later if desired (e.g., 'Shift+F5')
        click: () => { win?.webContents.send('trigger-run-project'); } // New trigger
      },
      {
        label: 'Run Active File',
        accelerator: 'Control+F5', // Match the shortcut used in App.tsx
        click: () => { win?.webContents.send('trigger-run-file'); }
      },
      {
        label: 'Preview Active File in Browser', 
        // Add accelerator later if desired (e.g., 'Alt+F5')
        click: () => { win?.webContents.send('trigger-preview-file'); } 
      },
      // Add 'Run Without Debugging', 'Start Debugging', etc. later
    ]
  },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' }, // macOS specific zoom
      { role: 'close' }
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          const { shell } = await import('electron');
          await shell.openExternal('https://github.com/your-repo'); // Replace with your repo URL
        }
      }
    ]
  }
];
// --- End Menu Template --- //

// --- Window Creation & App Lifecycle --- //

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Recommended security settings:
      contextIsolation: true, // Keep this true
      nodeIntegration: false, // Keep this false
      // nodeIntegrationInWorker: false,
      // webviewTag: false, // Disable if not needed
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    // Send initial zoom factor on load
    win?.webContents.send('zoom-updated', getZoomFactor());
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // --- REMOVED IPC Handler registrations from here --- //

  // Setup Application Menu
  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  // Handle window close
  win.on('closed', () => {
    // Clean up all PTY processes when the main window closes
    console.log('Main window closed, killing all PTY processes...');
    ptyProcesses.forEach((pty, id) => {
        console.log(`Killing PTY ID: ${id}`);
        pty.kill();
    });
    ptyProcesses.clear();
    win = null
  })
}

// --- App Event Listeners --- //

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  console.log('App ready, registering IPC handlers...');

  // Register ALL IPC handlers here BEFORE creating the window
  // File Operations
  ipcMain.handle('dialog:openFile', handleFileOpen)
  ipcMain.handle('dialog:saveFile', handleFileSave)
  ipcMain.handle('dialog:saveFileAs', handleFileSaveAs)
  ipcMain.handle('dialog:selectDirectory', handleSelectDirectory) 
  ipcMain.handle('fs:readDirectory', handleReadDirectory)
  ipcMain.handle('fs:readFileContent', handleReadFileContent)
  ipcMain.handle('fs:createFile', handleCreateFile)
  ipcMain.handle('fs:createDirectory', handleCreateDirectory)
  ipcMain.handle('fs:renameItem', handleRenameItem)
  ipcMain.handle('fs:deleteItem', handleDeleteItem)
  
  // Search
  ipcMain.handle('search:inFiles', handleSearchInFiles)

  // File Existence Check (Needed for project type detection)
  ipcMain.handle('fs:fileExists', (_event, filePath: string) => {
      try {
          return fsSync.existsSync(filePath);
      } catch (error) {
          console.error(`[main.ts] Error checking existence for ${filePath}:`, error);
          return false; // Return false on error
      }
  });

  // Zoom
  ipcMain.handle('app:zoom-in', zoomIn);
  ipcMain.handle('app:zoom-out', zoomOut);
  ipcMain.handle('app:zoom-reset', zoomReset);

  // Terminal (Moved from global scope)
  ipcMain.handle('pty:spawn', (_event, options: { cols: number, rows: number, cwd?: string }) => {
      if (!win) return { error: 'Main window not ready' };
      
      const { cols, rows, cwd } = options; // Destructure options
      const effectiveCwd = cwd && fsSync.existsSync(cwd) ? cwd : os.homedir(); // Use provided cwd if valid, else default
      
      console.log(`[main.ts] Spawning PTY with options:`, { cols, rows, cwd: effectiveCwd });
      
      let ptyProcess: IPty;
      let ptyId = -1;
      try {
          ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: cols || 80,
            rows: rows || 30,
            cwd: effectiveCwd, // Use effectiveCwd
            env: process.env as { [key: string]: string },
          });
          
          ptyId = getNextPtyId();
          ptyProcesses.set(ptyId, ptyProcess);
          console.log(`PTY process spawned with PID: ${ptyProcess.pid}, mapped to internal ID: ${ptyId}`);

      } catch (spawnError) {
          console.error('Failed to spawn PTY process:', spawnError);
          return { error: `Failed to spawn shell '${shell}' in '${effectiveCwd}': ${spawnError instanceof Error ? spawnError.message : 'Unknown Error'}` };
      }
      
      // Attach listeners only if spawn succeeded
      ptyProcess.onData((data) => {
        // Log before sending data to potentially destroyed renderer
        console.log(`[main.ts] PTY Data (ID: ${ptyId}): Received, checking window validity...`);
        if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
          console.log(`[main.ts] PTY Data (ID: ${ptyId}): Sending to renderer.`);
          win.webContents.send(`pty:data:${ptyId}`, data);
        } else {
            console.warn(`[main.ts] PTY Data (ID: ${ptyId}): Window/webContents destroyed, cannot send.`);
        }
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`[main.ts] PTY Exit (ID: ${ptyId}): Received exit code ${exitCode}, signal ${signal}.`);
        const ptyExists = ptyProcesses.has(ptyId);
        if (ptyExists) {
            console.log(`[main.ts] PTY Exit (ID: ${ptyId}): Removing from ptyProcesses map.`);
            ptyProcesses.delete(ptyId);
        } else {
            console.warn(`[main.ts] PTY Exit (ID: ${ptyId}): PTY ID not found in map, maybe already removed.`);
        }
        // Log before sending exit info
        console.log(`[main.ts] PTY Exit (ID: ${ptyId}): Checking window validity...`);
        if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
          console.log(`[main.ts] PTY Exit (ID: ${ptyId}): Sending exit info to renderer.`);
          win.webContents.send(`pty:exit:${ptyId}`, { exitCode, signal });
        } else {
            console.warn(`[main.ts] PTY Exit (ID: ${ptyId}): Window/webContents destroyed, cannot send exit info.`);
        }
      });

      // NEW: Listen for errors directly from the pty process
      // Cast to any to bypass potential type definition limitations for 'error' event
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ptyProcess as any).on('error', (err: Error) => { // Explicitly type err
          console.error(`[main.ts] PTY Error (ID: ${ptyId}):`, err);
          // Optionally notify renderer
          const ptyExistsOnError = ptyProcesses.has(ptyId);
          console.log(`[main.ts] PTY Error (ID: ${ptyId}): Checking window validity...`);
          if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
              // Define the channel for pty:error events
              const errorChannel = `pty:error:${ptyId}`;
              console.log(`[main.ts] PTY Error (ID: ${ptyId}): Sending error to renderer.`);
              win.webContents.send(errorChannel, err.message || 'Unknown PTY error');
          } else {
             console.warn(`[main.ts] PTY Error (ID: ${ptyId}): Window/webContents destroyed, cannot send error.`);
          }
          // Kill and clean up on error
          if (ptyExistsOnError) {
              console.log(`[main.ts] PTY Error (ID: ${ptyId}): Removing from ptyProcesses map.`);
              ptyProcesses.delete(ptyId);
              try { 
                  console.log(`[main.ts] PTY Error (ID: ${ptyId}): Attempting to kill process.`);
                  ptyProcess.kill(); 
                  console.log(`[main.ts] PTY Error (ID: ${ptyId}): Kill signal sent.`);
              } catch (killError) {
                  // Log potential error during kill, but continue cleanup
                  console.error(`[main.ts] Error trying to kill PTY process ${ptyId} after error:`, killError);
              }
          } else {
              console.warn(`[main.ts] PTY Error (ID: ${ptyId}): PTY ID not found in map during error handling.`);
          }
      });

      return { ptyId }; // Return our internal ID
  });
  // Prefix unused _event parameters in the .on handlers
  ipcMain.on('pty:write', (_event, ptyId: number, data: string) => {
    console.log(`[main.ts] IPC Received 'pty:write' for ID: ${ptyId}`);
    const ptyProcess = ptyProcesses.get(ptyId);
    if (ptyProcess) {
        console.log(`[main.ts] Forwarding write data to PTY ID: ${ptyId}`);
        ptyProcess.write(data);
    } else {
        console.warn(`[main.ts] 'pty:write' received for non-existent PTY ID: ${ptyId}`);
    }
  });
  ipcMain.on('pty:resize', (_event, ptyId: number, cols: number, rows: number) => {
    console.log(`[main.ts] IPC Received 'pty:resize' for ID: ${ptyId} (cols: ${cols}, rows: ${rows})`);
    const ptyProcess = ptyProcesses.get(ptyId);
    if (ptyProcess) {
        try { 
            console.log(`[main.ts] Resizing PTY ID: ${ptyId}`);
            ptyProcess.resize(cols, rows); 
        } catch (e) { 
            console.error(`[main.ts] Error resizing PTY ID ${ptyId}:`, e); 
        }
    } else {
        console.warn(`[main.ts] 'pty:resize' received for non-existent PTY ID: ${ptyId}`);
    }
  });
  ipcMain.on('pty:kill', (_event, ptyId: number) => {
    console.log(`[main.ts] IPC Received 'pty:kill' for ID: ${ptyId}`);
    const ptyProcess = ptyProcesses.get(ptyId);
    if (ptyProcess) { 
        console.log(`[main.ts] Sending kill signal to PTY ID: ${ptyId} via IPC`);
        try {
            ptyProcess.kill(); 
        } catch (killError) {
            console.error(`[main.ts] Error sending kill signal to PTY ID ${ptyId}:`, killError);
        }
        // DO NOT DELETE FROM MAP HERE - Let onExit handle it.
        // console.log(`[main.ts] Removing PTY ID: ${ptyId} from map after IPC kill.`);
        // ptyProcesses.delete(ptyId); 
    } else {
        console.warn(`[main.ts] 'pty:kill' received for non-existent PTY ID: ${ptyId}`);
    }
  });
  
  // OS Info handler
  ipcMain.handle('app:get-platform', () => {
    return os.platform(); // Return the platform string
  });
  
  // --- Live Preview IPC Handlers ---
  ipcMain.handle('preview:startServer', async (_event, filePath: string) => {
      if (!filePath) return { success: false, error: 'No file path provided' };
      const result = await startPreviewServer(filePath);
      if (result.success && result.url) {
          console.log(`[main.ts] Opening preview URL in browser: ${result.url}`);
          electronShell.openExternal(result.url); // Use Electron's shell module
      }
      return result;
  });

  ipcMain.handle('preview:stopServer', async () => {
      await stopPreviewServer();
      return { success: true };
  });
  // --- End Live Preview IPC Handlers ---

  console.log('IPC handlers registered.');
  createWindow();
});

// --- Live Preview Server Functions ---
async function startPreviewServer(filePath: string): Promise<{ success: boolean; url?: string; error?: string }> {
  if (previewServer) {
    console.log(`[main.ts] Stopping existing preview server on port ${previewServerPort}...`);
    await stopPreviewServer(); // Stop existing server before starting new one
  }
  
  const rootDir = path.dirname(filePath);
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/'); // Ensure forward slashes for URL
  const port = PREVIEW_DEFAULT_PORT; // Simplification: use fixed port for now

  console.log(`[main.ts] Starting preview server for root: ${rootDir} on port ${port}`);

  const server = http.createServer((request, response) => {
    // Use serve-handler to handle requests based on the root directory
    return serveHandler(request, response, {
      public: rootDir,
      cleanUrls: false, // Keep .html extension
      rewrites: [], // No rewrites needed usually
      headers: [ // Add headers to prevent aggressive caching during development
        { source: '**', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }
      ]
    });
  });

  return new Promise((resolve) => {
    server.on('error', (err) => {
      console.error(`[main.ts] Preview server error on port ${port}:`, err);
      resolve({ success: false, error: `Server error: ${err.message}` });
    });

    server.listen(port, () => {
      previewServer = server;
      previewServerPort = port;
      const url = `http://localhost:${port}/${relativePath}`;
      console.log(`[main.ts] Preview server listening on ${url}`);
      resolve({ success: true, url });
    });
  });
}

async function stopPreviewServer(): Promise<void> {
  return new Promise((resolve) => {
    if (previewServer) {
      console.log(`[main.ts] Closing preview server on port ${previewServerPort}...`);
      previewServer.close((err) => {
        if (err) {
          console.error('[main.ts] Error closing preview server:', err);
        }
        previewServer = null;
        previewServerPort = null;
        console.log('[main.ts] Preview server closed.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}
// --- End Live Preview Server Functions ---

// Ensure all PTY processes AND the preview server are killed/closed when the app quits completely
app.on('will-quit', async () => { // Make async
    console.log('App quitting, ensuring all PTY processes are killed...');
    ptyProcesses.forEach((pty, id) => {
        console.log(`Killing PTY ID: ${id}`);
        try { pty.kill(); } catch (e) { console.error(`Error killing PTY ${id}:`, e); }
    });
    ptyProcesses.clear();

    console.log('App quitting, stopping preview server...');
    await stopPreviewServer(); // Ensure server is stopped
});

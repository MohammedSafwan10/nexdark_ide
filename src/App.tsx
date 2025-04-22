import { useState, useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react'; // Import Monaco type
import type * as monaco from 'monaco-editor';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import path from 'path-browserify'; // Import path for extension extraction
import './App.css';
import type { IElectronAPI, TabInfo } from './types/electron'; // Import TabInfo
import ActivityBar from './components/ActivityBar'; // Import ActivityBar
import FileTree, { FileTreeHandle } from './components/FileTree'; // Import FileTreeHandle
import StatusBar from './components/StatusBar'; // Import StatusBar 
import TabBar from './components/TabBar'; // Import TabBar
import SearchPanel from './components/SearchPanel'; // Import SearchPanel
import CommandPalette, { Command } from './components/CommandPalette'; // Import CommandPalette
import { commandIcons } from './components/CommandIcons'; // Import command icons
import ConfirmationDialog from './components/ConfirmationDialog'; // Import ConfirmationDialog
import TerminalPanel from './components/TerminalPanel'; // Import TerminalPanel
import BottomPanelHeader from './components/BottomPanelHeader';
import ProblemsPanel from './components/ProblemsPanel';
import OutputPanel from './components/OutputPanel';
import DebugConsolePanel from './components/DebugConsolePanel';

// Declare the electronAPI on the window object
declare global {
  interface Window { electronAPI: IElectronAPI }
}

function App() {
  // --- State for Tabs ---
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const untitledCounter = useRef<number>(0);
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false); // State for folder loading
  
  // --- State for UI Controls ---
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [rootFolder, setRootFolder] = useState<string | null>(null);
  const [isConfirmDialogVisible, setIsConfirmDialogVisible] = useState<boolean>(false);
  const [confirmDialogProps, setConfirmDialogProps] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onDontSave?: () => void;
    onCancel: () => void;
  } | null>(null);

  // --- State for Sidebar View ---
  const [activeView, setActiveView] = useState<string>('explorer'); // Default to explorer

  // --- State for Bottom Panel ---
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState<boolean>(false);
  const [activeBottomView, setActiveBottomView] = useState<string>('terminal'); // Default to terminal for now

  // --- Refs ---
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null); // Ref to Monaco instance for language setting
  const fileTreeRef = useRef<FileTreeHandle>(null);
  const activePtyIdRef = useRef<number | null>(null); // Store the active PTY ID
  const modelsRef = useRef<Record<string, monaco.editor.ITextModel>>({}); // Cache for editor models
  // State to manage pending terminal command/cwd request
  const [terminalRequest, setTerminalRequest] = useState<{ command: string; cwd: string } | null>(null);
  
  // Define bottom panel views
  const bottomViews = [
    { id: 'problems', title: 'Problems' },
    { id: 'output', title: 'Output' },
    { id: 'debug', title: 'Debug Console' },
    { id: 'terminal', title: 'Terminal' },
  ];
  
  // --- Recalculate Active Tab Info --- 
  // This needs to be recalculated whenever tabs or activeTabId changes
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  
  // === Editor Mounting & Content Change Handling ===
  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    modelsRef.current = {}; // Initialize model cache
    editor.layout(); // Initial layout

    // Optional: Add other listeners if needed (e.g., onDidChangeCursorPosition)
  };

  // === Language Detection Helper ===
  const detectLanguage = useCallback((filePath: string | null): string => {
    if (!filePath || !monacoRef.current || !editorRef.current) return 'plaintext';
          const model = editorRef.current.getModel();
    if (!model) return 'plaintext';

    const ext = path.extname(filePath).toLowerCase();
              const lang = monacoRef.current.languages.getLanguages().find(l =>
                  l.extensions?.includes(ext)
              );

              if (lang) {
                  monacoRef.current.editor.setModelLanguage(model, lang.id);
      console.log(`Language set to: ${lang.id} for ${filePath}`);
      return lang.id;
    } else {
      monacoRef.current.editor.setModelLanguage(model, 'plaintext');
      console.log(`Extension '${ext}' not mapped for ${filePath}, falling back to plaintext.`);
      return 'plaintext';
    }
  }, []); // Depends only on refs

  // === Tab Management ===
  const addOrFocusTab = useCallback((newPath: string | null, newContent: string) => {
    const tabId = newPath ?? `untitled-${untitledCounter.current + 1}`;

    // Check if tab already exists (only for files with paths)
    const existingTabIndex = newPath ? tabs.findIndex(t => t.path === newPath) : -1;

    if (existingTabIndex > -1) {
      // File already open, just focus it
      const existingTab = tabs[existingTabIndex];
      console.log(`Focusing existing tab: ${existingTab.id}`);
      setActiveTabId(existingTab.id); // This will trigger the useEffect to set the model
      
      // --- NO LONGER setting value here --- 
      // if (editorRef.current && editorRef.current.getValue() !== existingTab.content) {
      //   editorRef.current.setValue(existingTab.content);
      //   detectLanguage(existingTab.path);
      // }
              } else {
      // Create a new tab
      if (!monacoRef.current || !editorRef.current) {
        console.error("Monaco or Editor instance not available for creating model.");
        return; // Cannot create tab without monaco instance
      }
      
      const newTitle = newPath ? path.basename(newPath) : `Untitled-${untitledCounter.current + 1}`;
      // Detect language *before* creating model
      const language = detectLanguage(newPath);
      
      // --- Create Monaco Model --- 
      const newModel = monacoRef.current.editor.createModel(
        newContent, 
        language, 
        newPath ? monacoRef.current.Uri.file(newPath) : undefined // Associate URI if path exists
      );
      modelsRef.current[tabId] = newModel; // Store model in cache
      console.log(`Created and cached model for new tab: ${tabId}`);

      const newTab: TabInfo = {
        id: tabId,
        path: newPath,
        title: newTitle,
        content: newContent,
        savedContent: newContent,
        isDirty: false,
        language: language,
        // Model property is not stored in React state, it's in modelsRef
      };

      console.log(`Adding new tab: ${newTab.id}`);
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId(newTab.id); // This will trigger the useEffect
      
      // --- NO LONGER setting value here --- 
      // editorRef.current?.setValue(newContent);
      // setTimeout(() => detectLanguage(newPath), 0);

      if (!newPath) {
        untitledCounter.current += 1;
      }
    }
    // Focus editor after potential state updates and model setting
    setTimeout(() => editorRef.current?.focus(), 0); 
  }, [tabs, detectLanguage]); // Removed activeTabId dependency as focusing triggers the effect

  // Update editor model and view state when active tab changes
  useEffect(() => {
    console.log(`Effect running for activeTabId: ${activeTabId}`);
    if (!editorRef.current) {
      console.log("Editor ref not ready, exiting effect.");
      return; // Editor not mounted yet
    }

    if (!activeTabId || !activeTab) {
      // No active tab, clear the editor model
      console.log("No active tab, setting model to null.");
      editorRef.current.setModel(null);
      return;
    }

    // --- Get the model for the active tab --- 
    const activeModel = modelsRef.current[activeTabId];
    if (!activeModel) {
        console.error(`Model not found in cache for active tab: ${activeTabId}!`);
        // Potentially try to recreate model here if needed, or show error
        editorRef.current.setModel(null); // Clear editor if model missing
      return;
    }

    // --- Set the editor's model --- 
    if (editorRef.current.getModel() !== activeModel) {
      console.log(`Switching editor model to: ${activeTabId}`);
      editorRef.current.setModel(activeModel);
    } else {
      console.log(`Editor already has the correct model for: ${activeTabId}`);
    }

    // --- Restore View State AFTER setting the model --- 
    if (activeTab.viewState) {
      console.log(`Restoring view state for tab: ${activeTab.id}`);
      // Use try-catch as restoreViewState can sometimes fail
      try {
        // Restore after a minimal delay to ensure model is fully set
        setTimeout(() => editorRef.current?.restoreViewState(activeTab.viewState!), 0); 
      } catch (e) {
          console.error(`Failed to restore view state for ${activeTab.id}:`, e);
      }
    } else {
      console.log(`No view state found for tab: ${activeTab.id}.`);
      // Optional: Reset scroll position if no state exists
      // editorRef.current.setScrollTop(0);
    }
    
    // Focus editor after model/view state applied
    setTimeout(() => editorRef.current?.focus(), 50); // Slightly longer delay?

    // --- Cleanup: Save View State of the OLD tab --- 
    const previousActiveTabId = activeTab.id;
    
    return () => {
        // Save view state only if the editor and the model for the *previous* tab exist
        const previousModel = modelsRef.current[previousActiveTabId];
        // Ensure we are saving state only if the model still matches the editor's current model
        if (editorRef.current && previousModel && editorRef.current.getModel() === previousModel) { 
            const previousViewState = editorRef.current.saveViewState();
            if (previousViewState) {
                console.log(`Cleanup: Saving view state for tab: ${previousActiveTabId}`);
                // Update the specific tab's view state EFFICIENTLY
                setTabs(prevTabs => {
                    const tabIndex = prevTabs.findIndex(t => t.id === previousActiveTabId);
                    if (tabIndex === -1) return prevTabs; // Tab not found
                    
                    const currentTab = prevTabs[tabIndex];
                    
                    // Compare view states (simple check, might need deep equality later)
                    if (currentTab.viewState !== previousViewState) { 
                         console.log(`View state for tab ${previousActiveTabId} HAS changed. Updating state.`);
                         const updatedTab = { ...currentTab, viewState: previousViewState };
                         const newTabs = [...prevTabs];
                         newTabs[tabIndex] = updatedTab;
                         return newTabs;
                    } else {
                         console.log(`View state for tab ${previousActiveTabId} has NOT changed. Skipping state update.`);
                         return prevTabs;
                    }
                });
            }
        }
    };

  }, [activeTabId, activeTab]); // Removed detectLanguage and tabs.length - rely only on activeTabId/activeTab changing

  // === Terminal Handling ===
  const handleTerminalReady = (ptyId: number) => {
    if (ptyId === -1) { // PTY process exited or was killed
      console.log('Terminal PTY process terminated.');
      activePtyIdRef.current = null;
    } else {
      activePtyIdRef.current = ptyId;
      console.log('Terminal ready with PTY ID:', ptyId);
    }
  };

  const handleRunActiveFileInTerminal = useCallback(async () => {
    console.log('Attempting to run active file...');
    if (!activeTab || !activeTab.path) {
      alert('No active file with a path to run.');
      return;
    }

    const filePath = activeTab.path;
    const extension = path.extname(filePath).toLowerCase();
    let command = '';
    
    // Get platform from main process
    const platform = await window.electronAPI.getPlatform();

    // Determine command based on extension
    switch (extension) {
      case '.js':
        command = 'node';
        break;
      case '.py':
        command = platform === 'win32' ? 'py' : 'python3';
        break;
      default:
        alert(`Cannot run file type: ${extension}`);
        return;
    }

    // Ensure terminal is visible
    if (!isBottomPanelVisible || activeBottomView !== 'terminal') {
      setActiveBottomView('terminal');
      setIsBottomPanelVisible(true);
      setTimeout(() => runCommandInTerminal(command, filePath, platform), 200); 
    } else {
        runCommandInTerminal(command, filePath, platform);
    }
  }, [activeTab, isBottomPanelVisible, activeBottomView]);

  const runCommandInTerminal = (interpreter: string, filePath: string, platform: string) => {
      if (activePtyIdRef.current === null) {
        alert('Terminal not ready. Please wait or try reopening it.');
        return;
      }
      const quotedPath = `"${filePath}"`;
      const fullCommand = `${interpreter} ${quotedPath}`;
      const newline = platform === 'win32' ? '\r\n' : '\n'; 
      console.log(`Running command in PTY ${activePtyIdRef.current}: ${fullCommand}`);
      window.electronAPI.ptyWrite(activePtyIdRef.current, fullCommand + newline);
  };

  // === Bottom Panel Toggle ===
  const toggleBottomPanel = useCallback((viewId: string = 'terminal') => {
    // If the requested view is already active and the panel is visible, close it.
    // Otherwise, show the panel and switch to the requested view.
    if (activeBottomView === viewId && isBottomPanelVisible) {
      setIsBottomPanelVisible(false);
    } else {
      setActiveBottomView(viewId);
      setIsBottomPanelVisible(true);
    }
  }, [activeBottomView, isBottomPanelVisible]);

  // === Command Palette & Search Panel Handlers ===
  const toggleCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(prev => !prev);
  }, []);

  const toggleSearchPanel = useCallback(() => {
    // Set activeView to 'search'. If already search, maybe toggle off?
    setActiveView(prev => prev === 'search' ? 'explorer' : 'search'); 
  }, []);

  const handleSearchResultClick = useCallback((filePath: string, line: number, column: number) => {
    // First ensure the file is opened in a tab
    const openFileAndNavigate = async () => {
      try {
        // Check if the file is already open
        const existingTab = tabs.find(tab => tab.path === filePath);
        if (existingTab) {
          setActiveTabId(existingTab.id);
        } else {
          // Open the file if not already open
          const result = await window.electronAPI.readFileContent(filePath);
          if (result.content !== undefined) {
            addOrFocusTab(filePath, result.content);
          } else if (result.error) {
            alert(`Error reading file: ${result.error}`);
            return;
          }
        }

        // Navigate to the line and column once the editor is ready
        // Use setTimeout to ensure the editor is mounted and the model is set
        setTimeout(() => {
          if (editorRef.current) {
            // Position is 0-based in Monaco, but our line and column are 1-based
            editorRef.current.revealPositionInCenter({
              lineNumber: line,
              column: column
            });
            editorRef.current.setPosition({
              lineNumber: line,
              column: column
            });
            editorRef.current.focus();
          }
        }, 100);
      } catch (error) {
        console.error('Error opening search result:', error);
      }
    };

    openFileAndNavigate();
  }, [tabs, addOrFocusTab]);

  // === File Operations (Declare Save/SaveAs BEFORE Close Tab) ===
  const handleSaveFileAs = useCallback(async () => {
    if (!activeTab || !editorRef.current) return;
    console.log(`Handle Save File As triggered for tab: ${activeTab.id}`);
    const currentContent = editorRef.current.getValue();

    try {
      const result = await window.electronAPI.saveFileAs(currentContent);
      if (result.success && result.filePath) {
        const newPath = result.filePath;
        const newTitle = path.basename(newPath);
        const newLanguage = detectLanguage(newPath);
        const oldTabId = activeTab.id;
        const newTabId = newPath; // Use the path as the new ID

        console.log(`File saved as: ${newPath}. Updating tab ${oldTabId} -> ${newTabId}`);

        setTabs(prevTabs => {
          // Check if a tab with the new path *already* exists (edge case: saving untitled over existing)
          const existingPathIndex = prevTabs.findIndex(t => t.path === newPath && t.id !== oldTabId);
          let updatedTabs = prevTabs;

          if (existingPathIndex > -1) {
              // If saving over an existing *different* tab, remove the old untitled/saved-as tab first
              console.warn(`Overwriting existing tab with path ${newPath}. Removing old tab ${oldTabId}.`);
              updatedTabs = prevTabs.filter(t => t.id !== oldTabId);
              // Update the content/state of the existing tab instead of adding a new one
              updatedTabs = updatedTabs.map(tab => {
                  if (tab.path === newPath) {
                      return {
                          ...tab,
                          content: currentContent,
                          savedContent: currentContent,
                          isDirty: false,
                          language: newLanguage // Update language too
                      };
                  }
                  return tab;
              });
          } else {
              // Otherwise, just update the current tab being saved
              updatedTabs = prevTabs.map(tab => {
                if (tab.id === oldTabId) {
                  return {
                    ...tab,
                    id: newTabId, // Update ID to the file path
                    path: newPath,
                    title: newTitle,
                    content: currentContent,
                    savedContent: currentContent,
                    isDirty: false,
                    language: newLanguage,
                  };
                }
                return tab;
              });
          }
          return updatedTabs;
        });
        setActiveTabId(newTabId); // Activate the newly saved tab (by its new path ID)
        // Ensure editor reflects the saved state (especially language)
        editorRef.current?.setValue(currentContent);
        setTimeout(() => detectLanguage(newPath), 0);

      } else if (result.error) {
        alert(`Error saving file: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving file as:', error);
      alert(`Error saving file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [activeTab, detectLanguage]);

  const handleSaveFile = useCallback(async () => {
    if (!activeTab || !editorRef.current) return;
    console.log(`Handle Save File triggered for tab: ${activeTab.id}`);

    const currentContent = editorRef.current.getValue(); // Get current content
    const filePathToSave = activeTab.path; // Use const instead of let

    // If it's an untitled file, trigger Save As instead
    if (!filePathToSave) {
      console.log("Untitled file, delegating to Save As...");
      handleSaveFileAs(); // Call Save As directly (now declared)
      return;
    }

    // Proceed with saving the existing file
    try {
      const result = await window.electronAPI.saveFile(filePathToSave, currentContent);
      if (result.success && result.filePath) {
        console.log('File saved:', result.filePath);
        // Update the saved state for the active tab
        setTabs(prevTabs => prevTabs.map(tab => {
          if (tab.id === activeTabId) {
            return { ...tab, content: currentContent, savedContent: currentContent, isDirty: false };
          }
          return tab;
        }));
      } else if (result.error) {
        alert(`Error saving file: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`Error saving file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

  }, [activeTab, activeTabId, handleSaveFileAs]); // Dependency is now valid

  // === Tab Closing Logic ===
  // Helper function to perform the actual tab closing logic
  const closeTab = useCallback((tabIdToClose: string) => {
    // --- Dispose Model --- 
    const modelToDispose = modelsRef.current[tabIdToClose];
    if (modelToDispose) {
        console.log(`Disposing model for closed tab: ${tabIdToClose}`);
        modelToDispose.dispose();
        delete modelsRef.current[tabIdToClose]; // Remove from cache
    } else {
        console.warn(`Model not found in cache for tab being closed: ${tabIdToClose}`);
    }
    
    setTabs(prevTabs => {
      const closingTabIndex = prevTabs.findIndex(t => t.id === tabIdToClose);
      const newTabs = prevTabs.filter(t => t.id !== tabIdToClose);

      // Determine next active tab
      if (activeTabId === tabIdToClose) {
        let nextActiveId: string | null = null;
        if (newTabs.length > 0) {
          // Try activating tab to the left, or the first tab
          nextActiveId = newTabs[Math.max(0, closingTabIndex - 1)]?.id ?? newTabs[0]?.id;
        }
        console.log(`Closed active tab. New active tab ID: ${nextActiveId}`);
        setActiveTabId(nextActiveId);
      } else {
        console.log(`Closed background tab ${tabIdToClose}. Active tab remains ${activeTabId}`);
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  const handleCloseTab = useCallback((tabIdToClose: string) => {
    const tabToClose = tabs.find(t => t.id === tabIdToClose);
    if (!tabToClose) return;

    console.log(`Handle Close Tab triggered for: ${tabIdToClose}`);

    if (tabToClose.isDirty) {
      // Use the confirmation dialog for dirty tabs
      setConfirmDialogProps({
        title: 'Unsaved Changes',
        message: `Do you want to save the changes you made to ${tabToClose.title}?`,
        onConfirm: async () => {
          console.log('Save confirmed');
          await handleSaveFile(); // Save the current tab
          closeTab(tabIdToClose);
          setIsConfirmDialogVisible(false);
        },
        onDontSave: () => {
          console.log('Don\'t Save confirmed');
          closeTab(tabIdToClose);
          setIsConfirmDialogVisible(false);
        },
        onCancel: () => {
          console.log('Cancel confirmed');
          setIsConfirmDialogVisible(false);
        },
      });
      setIsConfirmDialogVisible(true);
    } else {
      // If not dirty, close immediately
      closeTab(tabIdToClose);
    }
  }, [tabs, closeTab, handleSaveFile]); // Added handleSaveFile dependency

  // === Folder Opened Callback === 
  // Receives the path from FileTree when a folder is successfully opened
  const handleFolderOpened = useCallback((folderPath: string) => {
    console.log(`[App.tsx] handleFolderOpened: Received path from FileTree: ${folderPath}`);
    setRootFolder(folderPath);
    setActiveView('explorer'); // Switch back to explorer view on new folder
  }, []);

  // === Close All Tabs Logic ===
  const handleCloseAllTabs = useCallback(() => {
    console.log("Close all tabs triggered");
    
    // If any tab is dirty, confirm before closing
    const hasDirtyTabs = tabs.some(tab => tab.isDirty);
    
    if (hasDirtyTabs) {
      if (!confirm('Some tabs have unsaved changes. Close all tabs anyway?')) {
        return; // User cancelled
      }
    }
    
    // Clear all tabs and set active tab to null
    setTabs([]);
    setActiveTabId(null);
  }, [tabs]);

  // === Other File/Folder Operations (New, Open, etc.) ===
  const handleNewFile = useCallback(() => {
    console.log("Handle New File triggered");
    addOrFocusTab(null, ''); // Creates new untitled tab
  }, [addOrFocusTab]);

  const handleOpenFile = useCallback(async () => {
    console.log("Handle Open File triggered");
    const result = await window.electronAPI.openFile();
    if (!result.canceled && result.filePath && result.content !== undefined) {
      addOrFocusTab(result.filePath, result.content);
    } else if (result.error) {
      alert(`Error opening file: ${result.error}`);
    }
  }, [addOrFocusTab]);

  const handleOpenFileFromTree = useCallback(async (pathToOpen: string) => {
    console.log(`Handle Open File From Tree triggered: ${pathToOpen}`);
    try {
      // Check if already open first
      const existingTab = tabs.find(t => t.path === pathToOpen);
      if (existingTab) {
          setActiveTabId(existingTab.id);
          editorRef.current?.focus();
          return; // Don't re-read if already open
      }
      
      // If not open, read content and add tab
      const result = await window.electronAPI.readFileContent(pathToOpen);
      if (result.content !== undefined) {
        addOrFocusTab(pathToOpen, result.content);
      } else if (result.error) {
        alert(`Error reading file: ${result.error}`);
      }
    } catch (error) {
      console.error('Error opening file from tree:', error);
      alert(`Error opening file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [addOrFocusTab, tabs]);

  const handleSelectFolder = useCallback(async () => {
      if (isLoadingFolder) {
        console.log("Folder selection already in progress, ignoring duplicate request.");
        return;
      }

      console.log("Handle Select Folder triggered - Setting loading state");
      setIsLoadingFolder(true);

      // Allow state update to render before potentially blocking dialog
      await new Promise(resolve => setTimeout(resolve, 0)); 
      
      console.log("Proceeding with folder selection after short delay");
      try {
          // Ensure file tree ref is available before calling
          if (fileTreeRef.current) {
              console.log("Calling fileTreeRef.current.selectRootDirectory");
              const result = await fileTreeRef.current.selectRootDirectory(); // Wait for selection
              console.log("fileTreeRef.current.selectRootDirectory finished");
              
              // Update rootFolder state for search panel if available
              if (result && !result.canceled && result.path) {
                setRootFolder(result.path);
                setActiveView('explorer'); // Switch back to explorer view on new folder
              }
          } else {
              console.warn('FileTree ref not available yet');
          }
          // Optionally close existing tabs when a new folder is opened?
          // setTabs([]);
          // setActiveTabId(null);
      } catch (error) {
          console.error("Error selecting folder:", error);
          alert(`Error opening folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
          console.log("[App.tsx] handleSelectFolder: Resetting isLoadingFolder to false");
          setIsLoadingFolder(false); // Reset loading state
      }
  }, [isLoadingFolder]); // Add dependency

  const handleCloseFolder = useCallback(() => {
      console.log("[App.tsx] handleCloseFolder: Closing folder, resetting rootFolder"); // Log reset
      fileTreeRef.current?.closeRootDirectory();
      // Close all tabs when folder is closed
      console.log("Closing all tabs due to folder close.");
      setTabs([]);
      setActiveTabId(null);
      setRootFolder(null); // Reset root folder for search panel
      setActiveView('explorer'); // Reset view
      // Optionally open a new blank tab?
      // handleNewFile();
  }, []); // Removed handleNewFile dependency

  // === Keyboard Shortcuts ===
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette: Ctrl+Shift+P or Cmd+Shift+P
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        toggleCommandPalette();
      }
      
      // Search in files: Ctrl+Shift+F or Cmd+Shift+F
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        toggleSearchPanel();
      }
      
      // Run Active File: Ctrl+F5 
      if (e.key === 'F5' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleRunActiveFileInTerminal();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandPalette, toggleSearchPanel, handleRunActiveFileInTerminal]); // Add dependency

  // === Live Preview Handler ===
  const handlePreviewFile = useCallback(async () => {
    console.log('Attempting to preview active file...');
    if (!activeTab || !activeTab.path) {
      alert('No active file with a path to preview.');
      return;
    }
    
    const filePath = activeTab.path;
    const extension = path.extname(filePath).toLowerCase();

    // Only allow previewing HTML files for now
    if (extension !== '.html' && extension !== '.htm') {
      alert(`Cannot preview file type: ${extension}. Only HTML files are supported.`);
      return;
    }
    
    try {
      const result = await window.electronAPI.startFilePreview(filePath);
      if (result.success && result.url) {
        // No need to alert success, browser opening is confirmation
        console.log('Preview started successfully, opened:', result.url);
      } else if (result.error) {
        alert(`Failed to start preview server: ${result.error}`);
      }
    } catch (error) {
      console.error('Error starting file preview:', error);
      alert(`Error starting preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [activeTab]);

  // === Run Project Logic ===
  const handleRunProject = useCallback(async () => {
    console.log(`[App.tsx] handleRunProject: Attempting to run project. Current rootFolder: ${rootFolder}`); // Log rootFolder state
    if (!rootFolder) {
      alert('No project folder opened.');
      return;
    }

    // --- Project Type Detection ---
    try {
      // 1. Check for package.json (Node.js)
      const packageJsonPath = path.join(rootFolder, 'package.json');
      const hasPackageJson = await window.electronAPI.fileExists(packageJsonPath);

      if (hasPackageJson) {
        // Basic assumption: if package.json exists, use npm run dev
        const commandToRun = 'npm run dev';
        console.log(`[App.tsx] Detected project type: Node.js (package.json found), command: ${commandToRun}`);
        
        // Set the terminal request state
        const platform = await window.electronAPI.getPlatform();
        const newline = platform === 'win32' ? '\\r\\n' : '\\n';
        setTerminalRequest({ command: commandToRun + newline, cwd: rootFolder });

        // Ensure terminal panel is visible
        if (!isBottomPanelVisible || activeBottomView !== 'terminal') {
          setActiveBottomView('terminal');
          setIsBottomPanelVisible(true);
        }
        // The useEffect in TerminalPanel will handle spawning with cwd and running the command
        return; // Exit after handling Node.js project

      } else {
        // 2. Check for index.html (Basic Web Project)
        const indexPath = path.join(rootFolder, 'index.html');
        const hasIndexHtml = await window.electronAPI.fileExists(indexPath);

        if (hasIndexHtml) {
          console.log(`[App.tsx] Detected project type: Basic Web (index.html found)`);
          // Use the live preview mechanism
          try {
            const result = await window.electronAPI.startFilePreview(indexPath); // Preview index.html directly
            if (result.success && result.url) {
              console.log('[App.tsx] Project preview started successfully, opened:', result.url);
              // No need to alert success, browser opening is confirmation
            } else if (result.error) {
              alert(`Failed to start project preview server: ${result.error}`);
            }
          } catch (previewError) {
            console.error('[App.tsx] Error starting project preview:', previewError);
            alert(`Error starting preview: ${previewError instanceof Error ? previewError.message : 'Unknown error'}`);
          }
          return; // Exit after handling HTML project

        } else {
          // 3. If neither is found
          console.log('[App.tsx] No package.json or index.html found. Cannot determine project type.');
          alert('Could not determine how to run this project. No `package.json` or `index.html` found in the root.');
          return; // Exit
        }
      }

    } catch (error) {
      console.error('[App.tsx] Error detecting project type:', error);
      alert(`Could not determine how to run this project. Error: ${error instanceof Error ? error.message : 'Detection error'}`);
      return;
    }

    // This part should theoretically not be reached anymore due to returns in the try block
    // alert('Could not determine the command or action to run for this project.');

  }, [rootFolder, isBottomPanelVisible, activeBottomView]);

  // === Command palette commands ===
  const commands: Command[] = [
    {
      id: 'file.new',
      title: 'New File',
      category: 'File',
      icon: commandIcons['file.new'],
      shortcut: 'Ctrl+N',
      execute: handleNewFile
    },
    {
      id: 'file.open',
      title: 'Open File',
      category: 'File',
      icon: commandIcons['file.open'],
      shortcut: 'Ctrl+O',
      execute: handleOpenFile
    },
    {
      id: 'file.save',
      title: 'Save',
      category: 'File',
      icon: commandIcons['file.save'],
      shortcut: 'Ctrl+S',
      execute: handleSaveFile
    },
    {
      id: 'file.saveAs',
      title: 'Save As',
      category: 'File',
      icon: commandIcons['file.saveAs'],
      shortcut: 'Ctrl+Shift+S',
      execute: handleSaveFileAs
    },
    {
      id: 'file.close',
      title: 'Close Current Tab',
      category: 'File',
      icon: commandIcons['file.close'],
      execute: () => activeTabId && handleCloseTab(activeTabId)
    },
    {
      id: 'file.closeAll',
      title: 'Close All Tabs',
      category: 'File',
      icon: commandIcons['file.closeAll'],
      execute: handleCloseAllTabs
    },
    {
      id: 'folder.open',
      title: 'Open Folder',
      category: 'Folder',
      icon: commandIcons['folder.open'],
      execute: handleSelectFolder
    },
    {
      id: 'folder.close',
      title: 'Close Folder',
      category: 'Folder',
      icon: commandIcons['folder.close'],
      execute: handleCloseFolder
    },
    {
      id: 'search.inFiles',
      title: 'Search in Files',
      category: 'Search',
      icon: commandIcons['search.inFiles'],
      shortcut: 'Ctrl+Shift+F',
      execute: toggleSearchPanel
    },
    {
      id: 'view.commandPalette', // New command for command palette
      title: 'Command Palette',
      category: 'View',
      icon: commandIcons['view.theme'], // Reusing an icon, change if needed
      shortcut: 'Ctrl+Shift+P',
      execute: toggleCommandPalette
    },
    {
      id: 'execute.runInTerminal',
      title: 'Run Active File in Terminal',
      category: 'Run',
      icon: commandIcons['execute.runInTerminal'],
      shortcut: 'Ctrl+F5',
      execute: handleRunActiveFileInTerminal
    },
    {
      id: 'preview.inBrowser',
      title: 'Preview Active File in Browser',
      category: 'Run/Debug',
      icon: commandIcons['preview.inBrowser'],
      // Add shortcut later if desired
      execute: handlePreviewFile // Use the new handler
    },
    {
      id: 'execute.runProject', // New command ID
      title: 'Run Project',
      category: 'Run/Debug',
      icon: commandIcons['execute.runInTerminal'], // Reuse run icon for now
      // Add shortcut later if desired (e.g., Shift+F5)
      execute: handleRunProject
    },
  ];

  // === Set up Menu Listeners ===
  useEffect(() => {
    console.log("Setting up menu event listeners...");
    
    // Set up listeners using the refactored handlers and store cleanup functions
    const removeNewFileListener = window.electronAPI.onTriggerNewFile(handleNewFile);
    const removeOpenFileListener = window.electronAPI.onTriggerOpenFile(handleOpenFile);
    const removeSaveFileListener = window.electronAPI.onTriggerSaveFile(handleSaveFile);
    const removeSaveAsListener = window.electronAPI.onTriggerSaveAs(handleSaveFileAs);
    
    // Prevent menu trigger if already loading
    const selectFolderListener = () => {
        console.log("[App.tsx] Menu trigger-select-folder received. isLoadingFolder:", isLoadingFolder);
        // Check isLoadingFolder *before* calling the handler
        if (!isLoadingFolder) {
            handleSelectFolder(); 
        } else {
            console.log("[App.tsx] Ignoring menu trigger for folder select because isLoadingFolder is true.");
        }
    };
    const removeSelectFolderListener = window.electronAPI.onTriggerSelectFolder(selectFolderListener);
    const removeCloseFolderListener = window.electronAPI.onTriggerCloseFolder(handleCloseFolder);

    // Add listeners for Command Palette and Search
    const removeCommandPaletteListener = window.electronAPI.onTriggerCommandPalette(toggleCommandPalette);
    const removeSearchFilesListener = window.electronAPI.onTriggerSearchFiles(toggleSearchPanel);

    // Add listener for Run Active File
    const removeRunFileListener = window.electronAPI.onTriggerRunFile(handleRunActiveFileInTerminal);
    
    // Add listener for Preview Active File
    const removePreviewFileListener = window.electronAPI.onTriggerPreviewFile(handlePreviewFile);

    // Add listener for Run Project
    const removeRunProjectListener = window.electronAPI.onTriggerRunProject(handleRunProject);

    // Proper cleanup to prevent memory leaks and duplicate handlers
    return () => {
        console.log("Cleaning up menu listeners...");
        removeNewFileListener();
        removeOpenFileListener();
        removeSaveFileListener();
        removeSaveAsListener();
        removeSelectFolderListener();
        removeCloseFolderListener();
        removeCommandPaletteListener(); // Cleanup new listener
        removeSearchFilesListener(); // Cleanup new listener
        removeRunFileListener(); // Cleanup run listener
        removePreviewFileListener(); // Cleanup preview listener
        removeRunProjectListener(); // Cleanup run project listener
    };
    // Update listeners if handlers change
  }, [handleNewFile, handleOpenFile, handleSaveFile, handleSaveFileAs, handleSelectFolder, handleCloseFolder, isLoadingFolder, toggleCommandPalette, toggleSearchPanel, handleRunActiveFileInTerminal, handlePreviewFile, handleRunProject]); // Add handlePreviewFile and handleRunProject

  // === Zoom Handlers ===
  const handleZoomIn = () => window.electronAPI.zoomIn();
  const handleZoomOut = () => window.electronAPI.zoomOut();
  const handleZoomReset = () => window.electronAPI.zoomReset();

  // === Render ===
  return (
    <div className="flex flex-col h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-hidden">
      <TabBar 
        tabs={tabs} 
        activeTabId={activeTabId} 
        onSelectTab={setActiveTabId} 
        onCloseTab={handleCloseTab}
        onNewTab={handleNewFile}
        onCloseAllTabs={handleCloseAllTabs}
      />

      {/* Top Separator Bar */}
      <div className="flex-shrink-0 h-1 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
      </div>

      {/* Main Content Area (Activity Bar + Horizontal Panels) */}
      <div className="flex flex-grow overflow-hidden"> 
        <ActivityBar activeView={activeView} onSelectView={setActiveView} />

        {/* Horizontal Panel Group (Sidebar + Editor Area) */}
        <PanelGroup direction="horizontal" className="flex-grow overflow-hidden"> 
          
          {/* Sidebar Panel */}
          <Panel
            id="sidebar"
            order={1}
            defaultSize={20}
            minSize={15}
            maxSize={40}
            className="bg-[var(--bg-tertiary)] flex flex-col overflow-hidden"
          >
            {/* Conditional rendering for sidebar views */}
            <div className={`flex flex-col flex-grow ${activeView === 'explorer' ? '' : 'hidden'}`}>
              <FileTree 
                ref={fileTreeRef} 
                onFileSelect={handleOpenFileFromTree} 
                onFolderOpen={handleFolderOpened} // Pass the new callback
              />
            </div>
            <div className={`flex flex-col flex-grow ${activeView === 'search' ? '' : 'hidden'}`}>
              <SearchPanel rootFolder={rootFolder} onSelectResult={handleSearchResultClick} isVisible={activeView === 'search'} />
            </div>
            {/* Other sidebar placeholders */}
            {activeView !== 'explorer' && activeView !== 'search' && 
              <div className="p-4 text-[var(--text-secondary)]">{activeView.charAt(0).toUpperCase() + activeView.slice(1)} View Placeholder</div>}
          </Panel>
          
          <PanelResizeHandle className="w-1 bg-[var(--border-subtle)] hover:bg-[var(--accent-primary)] active:bg-[var(--accent-secondary)] transition-colors duration-100 cursor-col-resize flex-shrink-0" />

          {/* Editor Area Panel (Contains Vertical Group for Editor + Bottom Panel) */}
          {/* ADD relative positioning back, remove the outer conditional logic */}
          <Panel id="editor-area" order={2} className="flex flex-col overflow-hidden relative bg-[var(--bg-editor)]">
            {/* Render Editor + Bottom Panel Group UNCONDITIONALLY */}
            <PanelGroup direction="vertical" className="flex-grow overflow-hidden">
              
              {/* Editor Panel (Top part) */}
              <Panel id="editor" order={1} defaultSize={isBottomPanelVisible ? 75 : 100} minSize={40}>
                {/* Editor is now ALWAYS rendered */}
                <Editor
                  // key={activeTabId || 'no-tab'}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: true },
                    fontSize: 13,
                    wordWrap: 'on',
                    automaticLayout: true,
                  }}
                  onMount={handleEditorDidMount}
                />
              </Panel>
              
              {/* Bottom Panel Resize Handle */}
              {isBottomPanelVisible && (
                <PanelResizeHandle className="h-1 bg-[var(--border-subtle)] hover:bg-[var(--accent-primary)] active:bg-[var(--accent-secondary)] transition-colors duration-100 cursor-row-resize flex-shrink-0" />
              )}
              
              {/* Bottom Panel (Terminal, Problems, etc.) */}
              {isBottomPanelVisible && (
                <Panel 
                  id="bottom-panel" 
                  order={2} 
                  defaultSize={25} 
                  minSize={10} 
                  collapsible={true} 
                  collapsedSize={0} 
                  onCollapse={() => setIsBottomPanelVisible(false)}
                  className="flex flex-col bg-[var(--bg-secondary)]"
                >
                  {/* Bottom Panel Header (Tabs) */}
                  <BottomPanelHeader 
                    views={bottomViews}
                    activeViewId={activeBottomView}
                    onSelectView={setActiveBottomView}
                  />
                  {/* Conditional rendering for bottom views */}
                  <div className="flex-grow overflow-auto relative"> 
                    <ProblemsPanel isVisible={activeBottomView === 'problems'} />
                    <OutputPanel isVisible={activeBottomView === 'output'} />
                    <DebugConsolePanel isVisible={activeBottomView === 'debug'} />
                    <TerminalPanel 
                      isVisible={activeBottomView === 'terminal'} 
                      onReady={handleTerminalReady} 
                      initialCommand={terminalRequest?.command}
                      cwd={terminalRequest?.cwd}
                      onCommandSent={() => setTerminalRequest(null)}
                    />
                  </div>
                </Panel>
              )}
            </PanelGroup>

            {/* Welcome Message Overlay - Shown only when no tabs are open - Positioned relative to editor-area */}
            {/* This is the overlay logic from the previous successful centering attempt */}
            {tabs.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-editor)] p-4 z-10 pointer-events-none"> 
                <div className="text-center p-8 bg-[var(--bg-secondary)] rounded-lg shadow-md max-w-md space-y-5 pointer-events-auto"> 
                  <h2 className="text-2xl font-semibold text-[var(--text-muted)] mb-6">Welcome to NexDark IDE</h2>
                  
                  <div className="flex justify-center space-x-4">
                    <button 
                      onClick={handleSelectFolder} 
                      disabled={isLoadingFolder}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50"
                    >
                      {isLoadingFolder ? 'Opening...' : 'Open Project Folder'}
                    </button>
                    <span className="text-[var(--text-muted)] self-center">or</span>
                    <button 
                      onClick={handleOpenFile} 
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
                    >
                      Open File
                    </button>
                  </div>
                  
                  <div className="text-sm text-[var(--text-muted)] pt-4 space-y-2">
                      <p>
                          Press <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">Ctrl+Shift+P</kbd> or <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">⌘+Shift+P</kbd> to open the Command Palette
                      </p>
                      <p>
                          Press <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">Ctrl+Shift+F</kbd> or <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">⌘+Shift+F</kbd> to search in files
                      </p>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar
        zoomFactor={1} // Placeholder - needs state if zoom is dynamic
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        language={activeTab?.language ?? 'plaintext'}
        filePath={activeTab?.path ?? null}
        isDirty={activeTab?.isDirty ?? false}
        onToggleTerminal={() => toggleBottomPanel('terminal')} // Pass the toggle function correctly
        onToggleProblems={() => toggleBottomPanel('problems')} // Add toggle for problems
      />

      {/* Command Palette */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
      />

      {/* Confirmation Dialog */}
      {confirmDialogProps && (
        <ConfirmationDialog
          isOpen={isConfirmDialogVisible}
          title={confirmDialogProps.title}
          message={confirmDialogProps.message}
          confirmText="Save"
          dontSaveText="Don't Save"
          cancelText="Cancel"
          onConfirm={confirmDialogProps.onConfirm}
          onDontSave={confirmDialogProps.onDontSave}
          onCancel={confirmDialogProps.onCancel}
        />
      )}
    </div>
  );
}

export default App;

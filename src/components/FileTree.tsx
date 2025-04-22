import { useState, useCallback, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import path from 'path-browserify';
import { IconType } from 'react-icons';
import {
    // Existing icons
    VscFolder, VscFile, VscRefresh, VscJson, VscMarkdown, VscCode, VscTerminalBash,
    VscFilePdf, VscFileZip, VscLock,
    VscSymbolFile, VscSymbolNamespace, VscSymbolVariable, VscSymbolMethod,
    VscSymbolClass, VscSymbolInterface, VscTerminalCmd, VscTerminalPowershell,
    VscDatabase, VscGear, VscNote, VscBug, VscGitCompare,
    VscVm, VscPreview, VscExtensions,
    // New icons for header actions
    VscNewFile, VscNewFolder, VscCollapseAll,
    // Import Chevrons for folder expansion
    VscChevronRight, VscChevronDown,
    // Context menu actions
    VscEdit, VscTrash, VscError, VscFolderOpened, VscAdd
} from 'react-icons/vsc';

// Props
interface FileTreeProps {
    onFileSelect: (filePath: string) => void;
    onFolderOpen: (folderPath: string) => void;
}

// Exposed methods
export interface FileTreeHandle {
    selectRootDirectory: () => Promise<{ canceled: boolean; path?: string } | undefined>;
    closeRootDirectory: () => void;
}

// File entry structure
interface FileEntry {
    name: string;
    isDirectory: boolean;
    path: string;
    depth: number;
    childrenLoaded?: boolean;
}

// Icon Mapping Helper (remains the same)
const getIconForFile = (filename: string): IconType => {
    const lowerFilename = filename.toLowerCase();
    const extension = path.extname(lowerFilename);

    // Specific filenames first
    if (lowerFilename === 'dockerfile') return VscVm;
    if (lowerFilename === 'package.json') return VscJson;
    if (lowerFilename === 'package-lock.json' || lowerFilename === 'yarn.lock' || lowerFilename === 'pnpm-lock.yaml') return VscLock;
    if (lowerFilename === '.gitignore' || lowerFilename === '.gitattributes') return VscGitCompare;
    if (lowerFilename.endsWith('_test.go') || lowerFilename.includes('.spec.') || lowerFilename.includes('.test.')) return VscBug;
    if (lowerFilename.endsWith('.config.js') || lowerFilename.endsWith('.config.ts') || lowerFilename.includes('config')) return VscGear;
    if (lowerFilename.startsWith('.env')) return VscGear;

    // Then extensions
    switch (extension) {
        case '.ts':
        case '.tsx': return VscSymbolNamespace;
        case '.js':
        case '.jsx':
        case '.mjs':
        case '.cjs': return VscSymbolNamespace;
        case '.html':
        case '.htm': return VscCode;
        case '.css':
        case '.scss':
        case '.sass': return VscSymbolVariable;
        case '.json': return VscJson;
        case '.md':
        case '.markdown': return VscMarkdown;
        case '.py': return VscSymbolMethod;
        case '.java': return VscSymbolClass;
        case '.go': return VscSymbolMethod;
        case '.rs': return VscSymbolMethod;
        case '.cpp':
        case '.cxx':
        case '.cc':
        case '.hpp':
        case '.hxx': return VscSymbolClass;
        case '.c':
        case '.h': return VscSymbolInterface;
        case '.php': return VscSymbolMethod;
        case '.rb': return VscSymbolMethod;
        case '.swift': return VscSymbolMethod;
        case '.yaml':
        case '.yml': return VscGear;
        case '.xml': return VscCode;
        case '.csv': return VscSymbolVariable;
        case '.sql': return VscDatabase;
        case '.log': return VscNote;
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.gif':
        case '.svg':
        case '.ico':
        case '.webp': return VscPreview;
        case '.pdf': return VscFilePdf;
        case '.zip':
        case '.rar':
        case '.7z': return VscFileZip;
        case '.sh':
        case '.bash': return VscTerminalBash;
        case '.ps1': return VscTerminalPowershell;
        case '.bat':
        case '.cmd': return VscTerminalCmd;
        default:
            if (extension) return VscSymbolFile;
            return VscExtensions;
    }
};

const FileTree = forwardRef<FileTreeHandle, FileTreeProps>(({ onFileSelect, onFolderOpen }, ref) => {
    // --- State --- 
    const [rootDir, setRootDir] = useState<string | null>(null);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
    // Inline Creation State
    const [creatingItem, setCreatingItem] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
    // Inline Rename State
    const [renamingItemPath, setRenamingItemPath] = useState<string | null>(null);
    const [newItemName, setNewItemName] = useState(''); // Used for both creation and rename
    const inputRef = useRef<HTMLInputElement>(null);
    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileEntry } | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // --- Effects --- 
    // Focus input for create/rename
    useEffect(() => {
        if ((creatingItem || renamingItemPath) && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select(); // Select existing text when renaming
        }
    }, [creatingItem, renamingItemPath]);

    // Close context menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if the click is inside the context menu itself
            if (contextMenuRef.current && contextMenuRef.current.contains(event.target as Node)) {
                return; // Click was inside the menu, do nothing
            }
            
            // Check if the click originated within the Monaco editor area
            const targetElement = event.target as HTMLElement;
            if (targetElement.closest('.monaco-editor')) {
                // Click was inside the editor, let the editor handle its own context menu
                // Potentially close the file tree menu ONLY IF the editor menu isn't open? 
                // For now, let's just NOT close the file tree menu on editor clicks.
                // setContextMenu(null); // Maybe close it later if needed?
                return; 
            }
            
            // If click was outside the menu AND outside the editor, close the menu
            console.log("Click outside FileTree context menu and editor, closing.");
            setContextMenu(null);
        };
        
        const handleScroll = () => {
            console.log("Scroll detected, closing FileTree context menu.");
            setContextMenu(null);
        };

        if (contextMenu) {
            // Use capturing phase for potentially better interception
            document.addEventListener('mousedown', handleClickOutside, true); 
            window.addEventListener('scroll', handleScroll, true);
        } else {
            document.removeEventListener('mousedown', handleClickOutside, true);
            window.removeEventListener('scroll', handleScroll, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [contextMenu]);

    // === Directory Loading ===
    const loadDirectory = useCallback(async (dirPath: string, depth: number, isRoot = false) => {
        if (isLoading[dirPath] && !isRoot) return; // Allow refresh even if loading
        setIsLoading(prev => ({ ...prev, [dirPath]: true }));
        setError(null);
        try {
            const result = await window.electronAPI.readDirectory(dirPath);
            if ('error' in result) {
                setError(result.error);
                setExpandedFolders(prev => ({ ...prev, [dirPath]: false }));
            } else {
                const sortedEntries = result.sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                    return a.isDirectory ? -1 : 1;
                });
                const newEntries: FileEntry[] = sortedEntries.map(f => ({
                    ...f,
                    path: path.join(dirPath, f.name),
                    depth: depth,
                    childrenLoaded: false
                }));
                
                // More reliable approach to updating files
                setFiles(prevFiles => {
                    // For root refresh, we keep all expanded states but replace all entries
                    if (isRoot) {
                        return newEntries;
                    }
                    
                    // For non-root, find and update the relevant part of the tree
                    
                    // Remove any children of the expanded directory
                    const filteredFiles = prevFiles.filter(f => 
                        !f.path.startsWith(dirPath + path.sep) // Not a child of the expanded dir
                        || f.path === dirPath // Keep the parent itself
                    );
                    
                    // Find the index of the parent
                    const parentIndex = filteredFiles.findIndex(f => f.path === dirPath);
                    if (parentIndex === -1) {
                        console.warn("Parent directory not found:", dirPath);
                        return [...prevFiles, ...newEntries];
                    }
                    
                    // Mark parent as loaded
                    const updatedParent = {...filteredFiles[parentIndex], childrenLoaded: true};
                    filteredFiles[parentIndex] = updatedParent;
                    
                    // Insert children after parent
                    const result = [
                        ...filteredFiles.slice(0, parentIndex + 1),
                        ...newEntries,
                        ...filteredFiles.slice(parentIndex + 1)
                    ];
                    
                    return result;
                });

                // Ensure parent folder is expanded
                if (!expandedFolders[dirPath] && !isRoot) {
                    setExpandedFolders(prev => ({ ...prev, [dirPath]: true }));
                }
            }
        } catch (err) {
            console.error('Error calling readDirectory:', err);
            setError('An unexpected error occurred.');
            setExpandedFolders(prev => ({ ...prev, [dirPath]: false }));
        } finally {
            setIsLoading(prev => ({ ...prev, [dirPath]: false }));
        }
    }, [isLoading, expandedFolders]);

    // === Root Directory Actions ===
    // Internal handler for the button click and external call
    const handleSelectRootDirectoryClick = useCallback(async () => {
        console.log("[FileTree.tsx] handleSelectRootDirectoryClick called");
        try {
            const result = await window.electronAPI.selectDirectory();
            console.log("[FileTree.tsx] Electron selectDirectory result:", result);
            if (!result.canceled && result.path) {
                const newPath = result.path;
                console.log(`[FileTree.tsx] Folder selected: ${newPath}`);
                
                // Notify parent BEFORE setting local state
                onFolderOpen(newPath);
                
                setRootDir(newPath); // Update internal state
                setFiles([]); // Clear existing files
                setExpandedFolders({}); // Reset expanded state
                setSelectedPath(null); // Reset selection
                setError(null); // Clear previous errors
                await loadDirectory(newPath, 0, true); // Load the root directory
                return { canceled: false, path: newPath }; // Return for potential chaining if needed
            } else {
                console.log("[FileTree.tsx] Folder selection cancelled or path missing.");
                return { canceled: true };
            }
        } catch (err) {
            console.error('[FileTree.tsx] Error selecting directory:', err);
            setError('Failed to open directory.');
            return undefined; // Indicate error
        }
    }, [loadDirectory, onFolderOpen]); // Dependencies

    const handleCloseRootDirectory = useCallback(() => {
        console.log("[FileTree.tsx] closeRootDirectory called");
        setRootDir(null);
        setFiles([]);
        setExpandedFolders({});
        setSelectedPath(null);
        setError(null);
        // No need to notify parent here, App handles its own state reset
    }, []);

    // --- Exposed Methods via useImperativeHandle ---
    useImperativeHandle(ref, () => ({
        selectRootDirectory: handleSelectRootDirectoryClick, // Expose the internal handler
        closeRootDirectory: handleCloseRootDirectory
    }));

    // === Header Actions ===
    const handleRefresh = useCallback(() => {
        console.log("Refresh button clicked. Root dir:", rootDir);
        if (rootDir) {
            setCreatingItem(null);
            setRenamingItemPath(null);
            setContextMenu(null);
            setExpandedFolders({ [rootDir]: true }); 
            console.log("Calling loadDirectory for refresh...");
            loadDirectory(rootDir, 0, true);
        }
    }, [rootDir, loadDirectory]);

    const handleCollapseAll = useCallback(() => {
        console.log("Collapse All button clicked. Root dir:", rootDir);
        if (rootDir) {
            setCreatingItem(null);
            setRenamingItemPath(null);
            setContextMenu(null);
            setExpandedFolders({}); 
            console.log("Cleared expanded folders.");
        }
    }, [rootDir]);

    // --- Inline Item Creation --- 
    const triggerInlineCreate = useCallback((type: 'file' | 'folder', targetPath?: string) => {
         if (!rootDir) return;
         const parentPath = targetPath ?? (selectedPath && files.find(f => f.path === selectedPath)?.isDirectory ? selectedPath : rootDir);
          console.log(`Triggering new ${type} in:`, parentPath);
          // Ensure parent is expanded
          if (!expandedFolders[parentPath] && parentPath !== rootDir) {
               setExpandedFolders(prev => ({ ...prev, [parentPath]: true }));
          }
          setCreatingItem({ parentPath, type });
          setNewItemName(''); 
          setSelectedPath(null); // Deselect
          setRenamingItemPath(null);
          setContextMenu(null);
    }, [rootDir, selectedPath, files, expandedFolders]);

    const handleNewFileClick = useCallback(() => triggerInlineCreate('file'), [triggerInlineCreate]);
    const handleNewFolderClick = useCallback(() => triggerInlineCreate('folder'), [triggerInlineCreate]);

    // --- Context Menu Actions --- 
    const handleDelete = useCallback(async (itemPath: string) => {
        if (!itemPath) return;
        const itemName = path.basename(itemPath);
        if (confirm(`Are you sure you want to delete '${itemName}'? This cannot be undone.`)) {
             console.log("Attempting to delete:", itemPath);
             try {
                 const result = await window.electronAPI.deleteItem(itemPath);
                 console.log("Delete result:", result);
                 if (result.success) {
                     handleRefresh(); // Refresh the tree
                 } else {
                     alert(`Error deleting item: ${result.error || 'Unknown error'}`);
                 }
             } catch (error) {
                 console.error('IPC Error deleting item:', error);
                 alert(`Error deleting item: ${error instanceof Error ? error.message : 'IPC Error'}`);
             }
        }
        setContextMenu(null); // Close menu regardless
    }, [handleRefresh]);

    const triggerRename = useCallback((item: FileEntry) => {
        console.log("Triggering rename for:", item.path);
        setRenamingItemPath(item.path);
        setNewItemName(item.name); // Pre-fill with current name
        setCreatingItem(null);
        setContextMenu(null);
    }, []);

    // --- Input Handling (Create & Rename) --- 
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setNewItemName(event.target.value);
    };

    const cancelInput = () => {
        console.log("Cancelling input (create/rename)");
        setCreatingItem(null);
        setRenamingItemPath(null);
        setNewItemName('');
    };

    const confirmInput = async () => {
        if (!newItemName) {
            cancelInput();
            return;
        }
        // Handle Rename
        if (renamingItemPath) {
             console.log(`Attempting to rename '${renamingItemPath}' to '${newItemName}'`);
              try {
                 const result = await window.electronAPI.renameItem(renamingItemPath, newItemName);
                 console.log("Rename result:", result);
                 if (result.success) {
                     setRenamingItemPath(null);
                     setNewItemName('');
                     handleRefresh();
                 } else {
                     alert(`Error renaming: ${result.error || 'Unknown error'}`);
                     if (inputRef.current) inputRef.current.select();
                 }
             } catch (error) {
                 console.error('IPC Error renaming:', error);
                 alert(`Error renaming: ${error instanceof Error ? error.message : 'IPC Error'}`);
                 if (inputRef.current) inputRef.current.select();
             }
        }
        // Handle Create
        else if (creatingItem) {
            const newPath = path.join(creatingItem.parentPath, newItemName);
            console.log(`Attempting to create ${creatingItem.type} at:`, newPath);
             try {
                let result: { success: boolean; error?: string };
                if (creatingItem.type === 'file') {
                    result = await window.electronAPI.createFile(newPath);
                } else { 
                    result = await window.electronAPI.createDirectory(newPath);
                }
                console.log(`Create ${creatingItem.type} result:`, result);
                if (result.success) {
                    setCreatingItem(null);
                    setNewItemName('');
                    handleRefresh();
                } else {
                    alert(`Error creating ${creatingItem.type}: ${result.error || 'Unknown error'}`);
                    if (inputRef.current) inputRef.current.select();
                }
            } catch (error) {
                 console.error(`IPC Error creating ${creatingItem.type}:`, error);
                 alert(`Error creating ${creatingItem.type}: ${error instanceof Error ? error.message : 'IPC Error'}`);
                 if (inputRef.current) inputRef.current.select();
            }
        }
    };

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            confirmInput();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelInput();
        }
    };

     const handleInputBlur = () => {
        setTimeout(() => {
             if (creatingItem || renamingItemPath) { 
                 console.log("Input blurred, cancelling input.");
                 cancelInput();
             }
        }, 150); // Slightly longer delay for blur
    };

    // --- Context Menu Handling --- 
    const handleContextMenu = (event: React.MouseEvent<HTMLLIElement>, item: FileEntry) => {
        event.preventDefault();
        event.stopPropagation(); // Prevent parent handlers if needed
        console.log("Context menu for:", item.path);
        setSelectedPath(item.path); // Select the item on right-click
        setContextMenu({ x: event.clientX, y: event.clientY, item });
        setCreatingItem(null); // Cancel any ongoing creation
        setRenamingItemPath(null);
    };

    // === Tree Item Interaction ===
    const handleItemClick = (item: FileEntry) => {
        if (creatingItem) cancelInput(); // Cancel creation if clicking elsewhere
        setSelectedPath(item.path);
        
        if (item.isDirectory) {
            const isExpanded = !!expandedFolders[item.path];
            
            // Toggle expanded state
            setExpandedFolders(prev => {
                const updated = { ...prev, [item.path]: !isExpanded };
                
                // Special handling for large folders - when collapsing, we'll remove all child entries
                if (isExpanded) {
                    // The directory is currently expanded and will be collapsed
                    // Remove all child entries from the files list to prevent UI lag
                    setFiles(currentFiles => 
                        currentFiles.filter(f => 
                            !f.path.startsWith(item.path + path.sep) || f.path === item.path
                        )
                    );
                }
                
                return updated;
            });
            
            // Load children if expanding and not loaded yet
            if (!isExpanded && (!item.childrenLoaded || files.filter(f => 
                f.path.startsWith(item.path + path.sep)).length === 0)) {
                loadDirectory(item.path, item.depth + 1);
            }
        } else {
            onFileSelect(item.path);
        }
    };

    // === Rendering ===
    const renderTree = (entries: FileEntry[]) => {
        // Create a placeholder entry for the inline input if creating
        const creationPlaceholder = creatingItem ? { 
            path: path.join(creatingItem.parentPath, '__CREATING__'), // Unique key
            name: '__CREATING__', 
            isDirectory: creatingItem.type === 'folder', 
            depth: files.find(f => f.path === creatingItem?.parentPath)?.depth ?? (creatingItem.parentPath === rootDir ? -1 : 0) + 1 // Calculate depth
        } as FileEntry : null;

        // Organize entries into a proper tree-like structure
        const organizedEntries: FileEntry[] = [];
        
        // First, identify all the root-level entries
        const rootEntries = entries.filter(entry => entry.depth === 0);
        
        // Sort root entries (folders first, then alphabetically)
        rootEntries.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
            return a.isDirectory ? -1 : 1;
        });
        
        // Add root entries to our organized list
        organizedEntries.push(...rootEntries);
        
        // For each entry, find and add its children in the correct order
        const processedPaths = new Set<string>();
        
        // Process each entry to build a properly ordered tree
        const processEntry = (entry: FileEntry) => {
            if (processedPaths.has(entry.path)) return;
            processedPaths.add(entry.path);
            
            // We already added the entry itself, now find its direct children if it's expanded
            if (entry.isDirectory && expandedFolders[entry.path]) {
                const directChildren = entries
                    .filter(child => {
                        const parentDir = path.dirname(child.path);
                        return parentDir === entry.path && child.path !== entry.path;
                    })
                    .sort((a, b) => {
                        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                        return a.isDirectory ? -1 : 1;
                    });
                
                // Insert direct children after this entry
                const entryIndex = organizedEntries.findIndex(e => e.path === entry.path);
                if (entryIndex !== -1) {
                    organizedEntries.splice(entryIndex + 1, 0, ...directChildren);
                    
                    // Recursively process each child directory
                    directChildren
                        .filter(child => child.isDirectory)
                        .forEach(processEntry);
                }
            }
        };
        
        // Process all root entries
        rootEntries.forEach(processEntry);
        
        // Insert creation placeholder if needed
        if (creationPlaceholder && rootDir) {
            const parentPath = creatingItem?.parentPath || '';
            const parentIndex = organizedEntries.findIndex(f => f.path === parentPath);
            
            if (parentIndex !== -1) {
                // Insert after parent
                organizedEntries.splice(parentIndex + 1, 0, creationPlaceholder);
            } else if (parentPath === rootDir) {
                // Insert at the beginning for root level
                organizedEntries.unshift(creationPlaceholder);
            }
        }

        return organizedEntries.map((entry) => {
            // --- Render Inline Input (Create or Rename) --- 
            const isRenamingThis = renamingItemPath === entry.path;
            const isCreatingHere = entry.name === '__CREATING__' && creatingItem;
            
            if (isCreatingHere || isRenamingThis) {
                 const type = isCreatingHere ? creatingItem.type : (entry.isDirectory ? 'folder' : 'file');
                 const InputIcon = type === 'folder' ? VscFolder : VscFile;
                 const initialPadding = 0.75;
                 const depthPadding = (isRenamingThis ? entry.depth : entry.depth) * 1.25; // Use correct depth
                 const fileOffset = type === 'file' ? 1.125 : 0;
                 const paddingLeftRem = (entry.depth === 0 ? initialPadding : depthPadding) + fileOffset;

                 return (
                    <li
                        key={isCreatingHere ? entry.path : `rename-${entry.path}`}
                        className={`flex items-center text-sm py-1 pr-1`}
                        style={{ paddingLeft: `${paddingLeftRem}rem` }}
                    >
                        {type === 'folder' && <VscChevronRight className="mr-0.5 flex-shrink-0 w-4 h-4 text-[var(--text-secondary)] opacity-0" />}
                        <InputIcon className="mr-1.5 flex-shrink-0 w-4 h-4 text-[var(--accent-secondary)]" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={newItemName} // State holds value for both create/rename
                            onChange={handleInputChange}
                            onKeyDown={handleInputKeyDown}
                            onBlur={handleInputBlur}
                            placeholder={isCreatingHere ? (type === 'file' ? 'New File...' : 'New Folder...') : entry.name}
                            className="flex-grow px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--accent-primary)] rounded-sm focus:outline-none text-sm"
                            autoFocus
                        />
                    </li>
                 );
            }

            // --- Render Normal Item --- 
            const isSelected = selectedPath === entry.path;
            const isExpanded = expandedFolders[entry.path];
            const ChevronIcon = entry.isDirectory ? (isExpanded ? VscChevronDown : VscChevronRight) : null;
            const MainIcon = entry.isDirectory ? VscFolder : getIconForFile(entry.name);
            
            // Calculate padding for proper indentation
            const basePadding = entry.depth * 1.25;
            const fileTextPaddingOffset = 1.125;
            const initialOffset = 0.75;
            let paddingLeftRem;
            paddingLeftRem = (entry.depth === 0 ? initialOffset : basePadding);
            if (!entry.isDirectory) {
                 paddingLeftRem += fileTextPaddingOffset;
            }
            
            return (
                <li
                    key={entry.path}
                    className={`
                        cursor-pointer py-[2px] flex items-center text-xs relative
                        ${isSelected 
                            ? 'bg-[var(--list-active-selection-bg)] border-l-2 border-l-[var(--list-active-selection-border)] text-[var(--list-active-selection-fg)] font-medium'
                            : 'hover:bg-[var(--list-hover-bg)] border-l-2 border-l-transparent text-[var(--text-secondary)]'}
                    `}
                    onClick={() => handleItemClick(entry)}
                    onContextMenu={(e) => handleContextMenu(e, entry)}
                    title={entry.path}
                    style={{ paddingLeft: `${paddingLeftRem - 0.125}rem`
                    }}
                >
                    {entry.isDirectory && (
                        <span 
                            className="flex-shrink-0 w-4 h-4 flex items-center justify-center mr-0.5"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(entry);
                            }}
                        >
                            {ChevronIcon && (
                                <ChevronIcon 
                                    className={`flex-shrink-0 w-4 h-4 transition-transform duration-150
                                    ${isSelected ? 'text-[var(--list-active-selection-fg)]' : 'text-[var(--text-secondary)]'}
                                    ${isExpanded ? '' : 'transform rotate-0'}`} 
                                />
                            )}
                        </span>
                    )}
                    
                    <MainIcon 
                        className={`mr-1 flex-shrink-0 w-4 h-4
                            ${isSelected ? 'text-[var(--list-active-selection-fg)]' : ''}
                            ${entry.isDirectory 
                                ? (isExpanded ? 'text-[var(--list-active-selection-fg)]' : 'text-[var(--text-secondary)] opacity-90')
                                : ''}`} 
                    />
                    <span className="truncate select-none text-current">{entry.name}</span>
                </li>
            );
        });
    };

    // Reusable Header Button Component
    const HeaderButton = ({ icon: Icon, onClick, title }: { icon: IconType, onClick?: () => void, title: string }) => (
        <button
            onClick={onClick}
            className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-[var(--bg-tertiary)] disabled:text-gray-500 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            title={title}
            disabled={!onClick}
        >
            <Icon className="w-4 h-4" />
        </button>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-secondary)] font-sans text-[var(--text-primary)]">
            {/* Header Section - Actions always visible, no label */}
            <div className="flex items-center justify-end py-1.5 px-2 border-b border-[var(--border-subtle)] flex-shrink-0 select-none sticky top-0 z-10 bg-[var(--bg-secondary)]">
                <div className="flex items-center space-x-1">
                    <HeaderButton icon={VscNewFile} onClick={handleNewFileClick} title="New File" />
                    <HeaderButton icon={VscNewFolder} onClick={handleNewFolderClick} title="New Folder" />
                    <HeaderButton icon={VscRefresh} onClick={handleRefresh} title="Refresh Explorer" />
                    <HeaderButton icon={VscCollapseAll} onClick={handleCollapseAll} title="Collapse Folders" />
                </div>
            </div>

            {/* Root Directory Bar */}
            {rootDir && (
                <div className="px-2 py-1.5 border-b border-[var(--border-subtle)] select-none flex items-center justify-between bg-[var(--bg-secondary)] sticky top-[41px] z-10">
                    <div 
                        className={`text-sm font-medium truncate flex items-center hover:text-[var(--accent-primary)] cursor-pointer ${selectedPath === rootDir ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}
                        onClick={() => setSelectedPath(rootDir)}
                    >
                        <VscFolder className="mr-1.5 w-4 h-4 text-[var(--accent-secondary)]" />
                        {path.basename(rootDir)}
                    </div>
                    
                    {/* Path display for currently expanded folder */}
                    {selectedPath && selectedPath !== rootDir && (
                        <span className="text-xs text-[var(--text-secondary)] truncate max-w-[60%]" title={selectedPath.replace(rootDir, '')}>
                            {selectedPath.replace(rootDir, '')}
                        </span>
                    )}
                </div>
            )}

            {/* Loading / Error Messages */}
            {Object.values(isLoading).some(v => v) && (
                <div className="text-[var(--text-secondary)] text-xs px-3 py-2 border-b border-[var(--border-subtle)] flex items-center">
                    <span className="animate-spin mr-1.5">⟳</span>Loading...
                </div>
            )}
            {error && (
                <div className="text-[var(--accent-error)] text-xs px-3 py-2 border-b border-[var(--border-subtle)] flex items-center">
                    <VscError className="mr-1.5 flex-shrink-0" />Error: {error}
                </div>
            )}

            {/* File List or "Open Folder" prompt */}
            {!rootDir ? (
                <div className="flex-grow flex flex-col items-center justify-center p-4 text-center bg-[var(--bg-secondary)] overflow-hidden">
                    {/* Enhanced Empty State */}
                    <div className="w-full max-w-[320px] flex flex-col items-center transform transition-all duration-300">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-[var(--bg-tertiary)] opacity-30 rounded-full blur-md"></div>
                            <VscFolderOpened className="w-16 h-16 text-[var(--accent-secondary)] opacity-90 relative z-10" />
                            <div className="absolute -right-1 -bottom-1 rounded-full bg-[var(--accent-secondary)] p-1.5 shadow-md z-20">
                                <VscAdd className="w-4 h-4 text-[var(--bg-primary)]" />
                            </div>
                        </div>
                        
                        <h3 className="text-[var(--text-primary)] mb-3 text-lg font-semibold tracking-tight">No Folder Opened</h3>
                        <p className="text-[var(--text-secondary)] mb-6 text-sm max-w-[280px] leading-relaxed">
                            Open a folder to start exploring your project files and begin coding.
                        </p>
                        
                        <button
                            onClick={handleSelectRootDirectoryClick}
                            className="w-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-highlight)]
                                     px-5 py-2.5 rounded-md text-[var(--text-primary)] text-sm font-medium
                                     transition-all duration-200 border border-[var(--border-subtle)]
                                     focus:outline-none focus:ring-1 focus:ring-[var(--accent-secondary)]
                                     flex items-center justify-center space-x-2"
                        >
                            <VscFolderOpened className="w-5 h-5 text-[var(--accent-secondary)]" />
                            <span>Open Folder</span>
                        </button>
                    </div>
                </div>
            ) : (
                <ul className="flex-grow overflow-y-auto overflow-x-hidden py-1
                           scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)] hover:scrollbar-thumb-[var(--accent-primary)] scrollbar-track-[var(--bg-secondary)]">
                    {renderTree(files)}
                </ul>
            )}

            {/* Context Menu - VS Code Style */} 
            {contextMenu && (
                <div
                    ref={contextMenuRef}
                    className="fixed bg-[var(--bg-tertiary)] border border-[var(--border-medium)] rounded shadow-lg py-1 z-[1000] w-[220px]"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    <ul className="text-sm text-[var(--text-primary)]">
                        <li className="px-2 py-[6px] hover:bg-[var(--accent-primary)] hover:bg-opacity-20 cursor-pointer flex items-center" 
                            onClick={() => triggerInlineCreate('file', contextMenu.item.isDirectory ? contextMenu.item.path : path.dirname(contextMenu.item.path))}>
                            <VscNewFile className="w-4 h-4 mr-3 text-[var(--accent-secondary)]" /> New File
                        </li>
                        <li className="px-2 py-[6px] hover:bg-[var(--accent-primary)] hover:bg-opacity-20 cursor-pointer flex items-center" 
                            onClick={() => triggerInlineCreate('folder', contextMenu.item.isDirectory ? contextMenu.item.path : path.dirname(contextMenu.item.path))}>
                            <VscNewFolder className="w-4 h-4 mr-3 text-[var(--accent-secondary)]" /> New Folder
                        </li>
                        <li className="border-b border-[var(--border-subtle)] my-1"></li>
                        <li className="px-2 py-[6px] hover:bg-[var(--accent-primary)] hover:bg-opacity-20 cursor-pointer flex items-center" 
                            onClick={() => triggerRename(contextMenu.item)}>
                            <VscEdit className="w-4 h-4 mr-3 text-[var(--text-primary)]" /> Rename
                        </li>
                        <li className="px-2 py-[6px] hover:bg-[var(--accent-primary)] hover:bg-opacity-20 cursor-pointer flex items-center" 
                            onClick={() => handleDelete(contextMenu.item.path)}>
                            <VscTrash className="w-4 h-4 mr-3 text-[var(--accent-error)]" /> Delete
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
});

export default FileTree;
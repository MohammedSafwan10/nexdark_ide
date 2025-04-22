import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css'; // Import xterm CSS

interface TerminalPanelProps {
    isVisible: boolean;
    cwd?: string; // Optional working directory
    initialCommand?: string; // Optional command to run on start
    onReady?: (ptyId: number) => void; // Callback when PTY is ready
    onCommandSent?: () => void; // Callback after initial command is sent
    // Add props for managing multiple terminals later if needed (e.g., activeTerminalId, onTerminalClose)
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ 
    isVisible, 
    cwd, 
    initialCommand, 
    onReady, 
    onCommandSent 
}) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    // Store terminal instance and addons in refs
    const termInstanceRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    // Store the PTY ID associated with the *current* active terminal instance
    const currentPtyIdRef = useRef<number | null>(null);
    // Track loading state
    const [isTermLoading, setIsTermLoading] = useState(false);
    // Track if the component has mounted at least once
    const hasMounted = useRef(false);
    // Track if the initial command has been attempted for this instance
    const initialCommandAttempted = useRef(false);

    useEffect(() => {
        // Set mounted flag on first render
        hasMounted.current = true;
        console.log('[TerminalPanel] MOUNTED');
        // Cleanup on component unmount - Let the visibility effect handle PTY/xterm teardown
        return () => {
            console.log('[TerminalPanel] UNMOUNTING'); // Keep this log
            hasMounted.current = false;
            // No direct PTY/xterm cleanup here - tearDownTerminal in the other effect handles it
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array ensures this runs only once on mount/unmount

    // Effect to handle terminal creation/destruction based on visibility
    useEffect(() => {
        let resizeObserver: ResizeObserver | null = null;
        let onDataDisposable: { dispose: () => void } | null = null;
        let onResizeDisposable: { dispose: () => void } | null = null;
        let removeDataListener: (() => void) | null = null;
        let removeExitListener: (() => void) | null = null;
        let localPtyId: number | null = null; // Track PTY ID for this specific effect run
        let isMounted = true; // Track if component is still mounted during async ops

        // Reset command attempt flag when visibility changes or props influencing spawn change
        initialCommandAttempted.current = false;

        const setupTerminal = async () => {
            if (!terminalRef.current || termInstanceRef.current) return; // Already exists or no container

            console.log('TerminalPanel visible: Initializing xterm & PTY...', { cwd, initialCommand });
            setIsTermLoading(true);

            const xtermInstance = new Terminal({
                cursorBlink: true,
                fontSize: 13,
                fontFamily: `'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace`,
                theme: { // Apply basic theme variables (match theme.css)
                    background: '#181825', // --bg-secondary (or a dedicated terminal bg)
                    foreground: '#cdd6f4', // --text-primary
                    cursor: '#cdd6f4',     // --text-primary
                    selectionBackground: '#45475a', // --statusbar-item-hover (example)
                },
                convertEol: true,
                rows: 20, // Initial rows, FitAddon will adjust
            });
            const addon = new FitAddon();
            fitAddonRef.current = addon;
            termInstanceRef.current = xtermInstance;
            xtermInstance.loadAddon(addon);

            if (terminalRef.current) terminalRef.current.innerHTML = ''; // Clear container
            xtermInstance.open(terminalRef.current!); // Open in DOM
            const initialCols = xtermInstance.cols;
            const initialRows = xtermInstance.rows;

            try {
                const result = await window.electronAPI.ptySpawn({ 
                    cols: initialCols, 
                    rows: initialRows, 
                    cwd: cwd // Pass the cwd prop here
                });
                if (!isMounted) return;

                if (result.error || typeof result.ptyId !== 'number') {
                    throw new Error(result.error || 'Invalid PTY ID received');
                }
                
                localPtyId = result.ptyId;
                currentPtyIdRef.current = localPtyId;
                console.log('PTY spawned successfully with ID:', localPtyId);
                onReady?.(localPtyId);

                // --- Send Initial Command --- 
                if (initialCommand && !initialCommandAttempted.current) {
                    initialCommandAttempted.current = true; // Mark as attempted
                    console.log(`[TerminalPanel] Sending initial command to PTY ${localPtyId}: ${initialCommand.trim()}`);
                    // Determine newline based on platform (more robust would be getting it from main)
                    const platform = await window.electronAPI.getPlatform(); 
                    const newline = platform === 'win32' ? '\r\n' : '\n';
                    window.electronAPI.ptyWrite(localPtyId, initialCommand + newline);
                    onCommandSent?.(); // Notify parent that command was sent
                }
                // --- End Send Initial Command ---

                // Setup listeners
                onDataDisposable = xtermInstance.onData((data) => {
                    console.log(`[TerminalPanel] xterm.onData: Sending data to PTY ID ${currentPtyIdRef.current}`);
                    if (currentPtyIdRef.current !== null) window.electronAPI.ptyWrite(currentPtyIdRef.current, data);
                });
                removeDataListener = window.electronAPI.onPtyData(localPtyId, (data) => {
                    console.log(`[TerminalPanel] onPtyData (ID: ${localPtyId}): Received data, writing to xterm.`);
                    termInstanceRef.current?.write(data);
                });
                removeExitListener = window.electronAPI.onPtyExit(localPtyId, ({ exitCode }) => {
                    console.log(`[TerminalPanel] onPtyExit (ID: ${localPtyId}): Received exit code ${exitCode}.`);
                    if (termInstanceRef.current) {
                        termInstanceRef.current.write(`\r\n\r\n[Process exited with code ${exitCode}]\r\n`);
                    }
                    if (currentPtyIdRef.current === localPtyId) { // Clear ref only if it's the one that exited
                        console.log(`[TerminalPanel] onPtyExit: Clearing current PTY ID ref (${localPtyId}).`);
                        currentPtyIdRef.current = null;
                        onReady?.(-1);
                    }
                });

                // Initial fit and resize handling
                console.log('[TerminalPanel] Performing initial fit.');
                fitAddonRef.current.fit();
                resizeObserver = new ResizeObserver(() => {
                    console.log('[TerminalPanel] ResizeObserver triggered: Fitting addon.');
                    fitAddonRef.current?.fit()
                });
                if (terminalRef.current) resizeObserver.observe(terminalRef.current);
                onResizeDisposable = xtermInstance.onResize(({ cols, rows }) => {
                    console.log(`[TerminalPanel] xterm.onResize: Sending resize (cols: ${cols}, rows: ${rows}) to PTY ID ${currentPtyIdRef.current}`);
                    if (currentPtyIdRef.current !== null) window.electronAPI.ptyResize(currentPtyIdRef.current, cols, rows);
                });

                xtermInstance.focus();
                
            } catch (error) {
                console.error('Failed to setup terminal:', error);
                termInstanceRef.current?.write(`\r\nError initializing terminal: ${error instanceof Error ? error.message : 'Unknown error'}\r\n`);
                // Ensure partial setup is cleaned up if spawn fails
                if (termInstanceRef.current) {
                    termInstanceRef.current.dispose();
                    termInstanceRef.current = null;
                }
                currentPtyIdRef.current = null;
                onReady?.(-1);
            } finally {
                if (isMounted) setIsTermLoading(false);
            }
        };

        const tearDownTerminal = () => {
            console.log('TerminalPanel hidden or unmounting: Tearing down terminal...');
            isMounted = false; // Signal that async operations should not update state
            resizeObserver?.disconnect();
            onDataDisposable?.dispose();
            onResizeDisposable?.dispose();
            removeDataListener?.();
            removeExitListener?.();
            if (termInstanceRef.current) {
                termInstanceRef.current.dispose();
                termInstanceRef.current = null;
            }
            if (localPtyId !== null) { // Use the ID tracked by this specific effect run
                console.log(`[TerminalPanel] TearDown: Killing PTY ID: ${localPtyId}`);
                window.electronAPI.ptyKill(localPtyId);
                // Only clear the main ref if it still holds the ID we are tearing down
                if (currentPtyIdRef.current === localPtyId) { 
                    console.log(`[TerminalPanel] TearDown: Clearing current PTY ID ref (${localPtyId}) after kill.`);
                    currentPtyIdRef.current = null;
                    onReady?.(-1); // Notify parent
                }
            }
            fitAddonRef.current = null;
        };

        if (isVisible && hasMounted.current) {
            setupTerminal();
        } else if (hasMounted.current && !isVisible) { // Ensure teardown only happens when becoming invisible
             tearDownTerminal();
        }

        // Cleanup function for this effect run
        return () => {
            isMounted = false; 
            tearDownTerminal();
        };
    // Include cwd and initialCommand in dependencies
    }, [isVisible, onReady, cwd, initialCommand, onCommandSent]);

    // Ensure fit is called when the panel becomes visible after initial load
    useEffect(() => {
        if (isVisible && termInstanceRef.current && fitAddonRef.current) {
            const timer = setTimeout(() => {
                try {
                    fitAddonRef.current?.fit();
                } catch (e) {
                    console.warn("FitAddon resize error on visibility change:", e);
                }
            }, 50); 
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    return (
        <div 
            className={`h-full w-full flex flex-col bg-[var(--bg-secondary)] ${!isVisible ? 'hidden' : ''}`}
        >
            {/* Optional: Add Terminal Tabs here later */}
            <div ref={terminalRef} className="flex-grow w-full h-full p-1 overflow-hidden relative">
                {isTermLoading && isVisible && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-secondary)]">
                        Loading Terminal...
                    </div>
                )}
            </div>
        </div>
    );
};

export default TerminalPanel; 
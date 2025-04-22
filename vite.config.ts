import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

// Define type for plugin options for clarity (based on common usage)
// You might need to refine this based on the actual plugin version/docs
type MonacoPluginOptions = {
  languages?: string[];
  features?: string[];
  customWorkers?: { label: string; entry: string }[];
  // Add other potential options here
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Revert to using .default to fix runtime TypeError, accepting the 'any' lint warning
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (monacoEditorPlugin as any).default({
        languages: ['typescript', 'javascript', 'css', 'html', 'json'], // Explicitly include desired languages
        features: [ // Include common features
            'coreCommands', 
            'codeAction', 
            'bracketMatching', 
            'caretOperations', 
            'clipboard', 
            'comment', 
            'contextmenu', 
            'cursorUndo', 
            'find',
            'folding',
            'format',
            'gotoLine',
            'hover',
            'inPlaceReplace',
            'indentation', 
            'inlineHints', 
            'inspectTokens', 
            'linesOperations', 
            'linkedEditing', 
            'markerNavigation', 
            'multicursor', 
            'parameterHints', 
            'quickCommand', 
            'quickHelp', 
            'quickOutline', 
            'referenceSearch', 
            'rename', 
            'smartSelect', 
            'snippets', 
            'suggest', 
            'toggleHighContrast', 
            'toggleTabFocusMode', 
            'transpose', 
            'wordHighlighter', 
            'wordOperations', 
            'wordPartOperations'
        ]
    } as MonacoPluginOptions), // Type assertion helps slightly
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        // Tell Rollup to treat node-pty as external in the main process build
        vite: {
          build: {
            rollupOptions: {
              external: ['node-pty'],
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }), // Restore closing parenthesis for electron
  ], // Restore closing bracket for plugins
  // Ensure native modules like node-pty are not bundled for the renderer
  optimizeDeps: {
    exclude: ['node-pty'],
  },
}) // Restore closing parenthesis for defineConfig
import { 
  VscNewFile, VscFiles, VscSettings, 
  VscFolderOpened, VscSave, VscChromeClose,
  VscSearch, VscSymbolColor, VscRefresh, VscDebugRestart,
  VscColorMode, VscExtensions, VscTerminal, VscPlay,
  VscBrowser
} from 'react-icons/vsc';

// Default command icons mapping
export const commandIcons = {
  'file.new': <VscNewFile />,
  'file.open': <VscFiles />,
  'file.save': <VscSave />,
  'file.saveAs': <VscSave />,
  'file.close': <VscChromeClose />,
  'file.closeAll': <VscChromeClose />,
  'folder.open': <VscFolderOpened />,
  'folder.close': <VscFolderOpened />,
  'search.inFiles': <VscSearch />,
  'view.theme': <VscSymbolColor />,
  'view.refresh': <VscRefresh />,
  'editor.restart': <VscDebugRestart />,
  'preferences.settings': <VscSettings />,
  'preferences.theme': <VscColorMode />,
  'view.extensions': <VscExtensions />,
  'terminal.new': <VscTerminal />,
  'execute.runInTerminal': <VscPlay />,
  'preview.inBrowser': <VscBrowser />,
}; 
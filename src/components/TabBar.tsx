import React from 'react';
import { TabInfo } from '../types/electron';
import {
  VscChromeClose, VscCode, VscJson, VscMarkdown, VscSymbolProperty,
  VscSymbolEvent, VscSymbolMethod, VscGear, VscClearAll, VscNote, VscFile
} from 'react-icons/vsc';

interface TabBarProps {
  tabs: TabInfo[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseAllTabs?: () => void;
}

// Map file extensions/languages to icons (remove hardcoded colors)
const getIconForLanguage = (language: string, path: string | null) => {
  const ext = path ? path.split('.').pop()?.toLowerCase() : '';
  
  // Try language first
  switch(language) {
    case 'typescript':
    case 'typescriptreact': return <VscSymbolEvent className="w-4 h-4" />;
    case 'javascript':
    case 'javascriptreact': return <VscSymbolMethod className="w-4 h-4" />;
    case 'json': return <VscJson className="w-4 h-4" />;
    case 'html': return <VscCode className="w-4 h-4" />;
    case 'css':
    case 'scss':
    case 'less': return <VscSymbolProperty className="w-4 h-4" />;
    case 'markdown': return <VscMarkdown className="w-4 h-4" />;
  }
  
  // Fallback to extension if language match failed or was generic
  switch(ext) {
    case 'ts':
    case 'tsx': return <VscSymbolEvent className="w-4 h-4" />;
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs': return <VscSymbolMethod className="w-4 h-4" />;
    case 'json': return <VscJson className="w-4 h-4" />;
    case 'html': return <VscCode className="w-4 h-4" />;
    case 'css':
    case 'scss':
    case 'less': return <VscSymbolProperty className="w-4 h-4" />;
    case 'md': return <VscMarkdown className="w-4 h-4" />;
    case 'yaml':
    case 'yml': return <VscGear className="w-4 h-4" />;
    case 'log': return <VscNote className="w-4 h-4" />;
    case 'txt': return <VscNote className="w-4 h-4" />;
    default:
      return <VscFile className="w-4 h-4" />; // Generic file icon
  }
};

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTabId, onSelectTab, onCloseTab, onNewTab, onCloseAllTabs }) => {
  return (
    <div className="flex h-10 bg-[var(--bg-secondary)] border-b border-[var(--tab-border)] overflow-x-auto scrollbar-none flex-shrink-0">
      <div className="flex flex-1 h-full">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          
          return (
            <div
              key={tab.id}
              className={`
                flex items-center min-w-[120px] max-w-[200px] h-full px-3 
                border-r border-[var(--tab-border)] relative group
                ${isActive 
                  ? 'bg-[var(--tab-active-bg)] text-[var(--text-primary)]' 
                  : 'bg-[var(--tab-inactive-bg)] text-[var(--text-secondary)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]'}
                transition-colors duration-150 ease-in-out cursor-pointer
              `}
              onClick={() => onSelectTab(tab.id)}
            >
              {/* Active tab indicator (Top border) */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--tab-active-border)]" />
              )}
              
              {/* File icon */}
              <div className="mr-2 flex-shrink-0 text-current opacity-80">
                {getIconForLanguage(tab.language, tab.path)}
              </div>
              
              {/* Tab title (slightly dimmer if inactive) */}
              <div className={`flex-1 truncate text-sm font-medium ${isActive ? '' : 'opacity-90'}`}>
                {tab.title} {/* Use the title from TabInfo */} 
              </div>
              
              {/* Close button */}
              <button
                className={`
                  flex items-center justify-center ml-2 rounded-sm p-0.5 flex-shrink-0
                  text-[var(--text-secondary)] 
                  ${isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-60'} 
                  hover:opacity-100 hover:bg-[var(--button-secondary-hover-bg)]
                  transition-opacity duration-150
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                aria-label="Close tab"
              >
                <VscChromeClose className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        
        {/* Tab management buttons */}
        <div className="flex items-center border-l border-[var(--tab-border)]">
          {/* New tab button */}
          <button
            className="flex items-center justify-center h-full px-3 text-[var(--text-secondary)] 
                      hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)] transition-colors duration-150"
            onClick={onNewTab}
            aria-label="New tab"
            title="New Tab"
          >
            <span className="text-lg font-light">+</span>
          </button>
          
          {/* Close all tabs button */}
          {tabs.length > 0 && onCloseAllTabs && (
            <button
              className="flex items-center justify-center h-full px-3 text-[var(--text-secondary)] 
                        hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)] transition-colors duration-150 relative group"
              onClick={onCloseAllTabs}
              aria-label="Close all tabs"
              title="Close all tabs"
            >
              <VscClearAll className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TabBar; 
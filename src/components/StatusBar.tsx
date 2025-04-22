import React from 'react';
import {
  VscZoomIn,
  VscZoomOut,
  VscSourceControl,
  VscError,
  VscWarning,
  VscBell,
  VscFeedback
} from 'react-icons/vsc';

// Helper component for status bar items for consistent styling
const StatusItem: React.FC<{ children: React.ReactNode, onClick?: () => void, title?: string, className?: string }> =
  ({ children, onClick, title, className = '' }) => (
  <button
    onClick={onClick}
    title={title}
    className={`h-full px-2 text-[11px] flex items-center
      ${onClick ? 'hover:bg-[var(--statusbar-item-hover)] active:bg-[var(--accent-primary)]' : ''}
      focus:outline-none focus:bg-[var(--statusbar-item-hover)]
      transition-colors duration-150
      ${onClick ? 'cursor-pointer' : 'cursor-default'} ${className}`}
    disabled={!onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : -1}
  >
    {children}
  </button>
);

// Divider component
const Divider = () => (
  <div className="h-3 w-[1px] bg-[var(--border-subtle)] mx-1 self-center"></div>
);

interface StatusBarProps {
  zoomFactor: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  language: string;
  filePath: string | null;
  isDirty: boolean;
  onToggleTerminal?: () => void;
  onToggleProblems?: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  zoomFactor,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  language,
  filePath,
  isDirty,
  onToggleTerminal,
}) => {
  const zoomPercentage = Math.round(zoomFactor * 100);
  const platform = navigator.platform.match(/Mac/i) ? 'Cmd' : 'Ctrl';
  
  // Get filename from filePath if available
  const filename = filePath ? filePath.split(/[\\/]/).pop() || 'Untitled' : 'Untitled';

  return (
    <div className="h-6 bg-[var(--statusbar-bg)] border-t border-[var(--border-subtle)] flex items-stretch justify-between text-[var(--text-secondary)] flex-shrink-0 text-[11px] select-none overflow-hidden" role="statusbar">
      {/* Left Side */}
      <div className="flex items-stretch h-full">
        {/* Git Branch (left-most item) */}
        <StatusItem title="Source Control">
          <div className="flex items-center">
            <VscSourceControl className="w-3.5 h-3.5 mr-1.5 text-[var(--accent-secondary)]" /> 
            <span>main</span>
          </div>
        </StatusItem>
        
        <Divider />
        
        {/* File name indicator */}
        <StatusItem title={filePath || 'No file open'}>
          <div className="flex items-center">
            {isDirty ? <span className="mr-1.5 text-[var(--accent-error)]">●</span> : null}
            {filename}
          </div>
        </StatusItem>
        
        <Divider />
        
        {/* Problems */}
        <StatusItem title="No Problems">
          <div className="flex items-center">
            <VscError className="w-3 h-3 mr-1 text-[var(--accent-error)]" /> 0
            <VscWarning className="w-3 h-3 mx-1 text-[var(--accent-warning)]" /> 0
          </div>
        </StatusItem>
      </div>

      {/* Right Side */}
      <div className="flex items-stretch h-full">
        {/* Line/Col */}
        <StatusItem title="Go to Line/Column">
          Ln 14, Col 10
        </StatusItem>
        
        {/* Spaces */}
        <StatusItem title="Select Indentation">
          Spaces: 2
        </StatusItem>
        
        {/* Encoding */}
        <StatusItem title="Select Encoding">
          UTF-8
        </StatusItem>
        
        {/* End of Line */}
        <StatusItem title="Select End of Line Sequence">
          LF
        </StatusItem>
        
        {/* Language Mode */}
        <StatusItem title="Select Language Mode">
          {language === 'plaintext' ? 'Plain Text' : language.charAt(0).toUpperCase() + language.slice(1)}
        </StatusItem>
        
        <Divider />
        
        {/* Command Palette Shortcut */}
        <StatusItem title="Open Command Palette">
          <span className="text-xs">{navigator.platform.match(/Mac/i) ? '⌘⇧P' : 'Ctrl+Shift+P'}</span>
        </StatusItem>
        
        {/* Search Shortcut */}
        <StatusItem title="Search in Files">
          <span className="text-xs">{navigator.platform.match(/Mac/i) ? '⌘⇧F' : 'Ctrl+Shift+F'}</span>
        </StatusItem>
        
        <Divider />
        
        {/* Terminal Toggle Button */}
        {onToggleTerminal && (
            <>
                <Divider />
                <StatusItem onClick={onToggleTerminal} title="Toggle Terminal (Ctrl+`)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 mr-1">
                        <path d="M0 2.5A1.5 1.5 0 0 1 1.5 1h13A1.5 1.5 0 0 1 16 2.5v11A1.5 1.5 0 0 1 14.5 15h-13A1.5 1.5 0 0 1 0 13.5v-11Zm1.5-.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-13Z" />
                        <path d="M2.53 5.47a.5.5 0 0 1 .71 0L5.1 7.3a.5.5 0 0 1 0 .71l-1.86 1.85a.5.5 0 1 1-.71-.71L4.05 7.65 2.53 6.18a.5.5 0 0 1 0-.71Zm3.21 2.68a.5.5 0 0 1 .71 0l1 1a.5.5 0 0 1-.71.71l-1-1a.5.5 0 0 1 0-.71Z" />
                    </svg>
                    Terminal
                </StatusItem>
            </>
        )}
        
        {/* Zoom Controls - more compact */}
        <StatusItem onClick={onZoomOut} title={`Zoom Out (${platform}+-)`} className="px-1.5">
          <VscZoomOut className="w-3.5 h-3.5 text-[var(--text-primary)]" />
        </StatusItem>
        
        <StatusItem 
          onClick={onZoomReset} 
          title={`Reset Zoom (${platform}+0)`} 
          className="w-10 justify-center"
        >
          {zoomPercentage}%
        </StatusItem>
        
        <StatusItem onClick={onZoomIn} title={`Zoom In (${platform}+=)`} className="px-1.5">
          <VscZoomIn className="w-3.5 h-3.5 text-[var(--text-primary)]" />
        </StatusItem>
        
        <Divider />
        
        {/* Feedback */}
        <StatusItem title="Tweet Feedback" className="px-1.5">
          <VscFeedback className="w-3.5 h-3.5 text-[var(--accent-tertiary)]" />
        </StatusItem>
        
        {/* Notifications */}
        <StatusItem title="No Notifications" className="px-1.5">
          <VscBell className="w-3.5 h-3.5 text-[var(--text-primary)]" />
        </StatusItem>
      </div>
    </div>
  );
};

export default StatusBar;

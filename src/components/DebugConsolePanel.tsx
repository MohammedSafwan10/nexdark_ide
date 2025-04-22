import React from 'react';

interface DebugConsolePanelProps {
  isVisible: boolean;
}

const DebugConsolePanel: React.FC<DebugConsolePanelProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-secondary)] p-2 text-[var(--text-secondary)] text-sm">
      {/* TODO: Implement Debug Console View - Needs debug adapter integration */}
      <div>Debug Console Placeholder</div>
      <div>(Debugger not attached)</div>
    </div>
  );
};

export default DebugConsolePanel; 
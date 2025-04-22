import React from 'react';

interface OutputPanelProps {
  isVisible: boolean;
}

const OutputPanel: React.FC<OutputPanelProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-secondary)] p-2 text-[var(--text-secondary)] text-sm">
      {/* TODO: Implement Output View - Show logs from extensions, tasks, etc. */}
      <div>Output Placeholder</div>
      {/* Add dropdown to select output channel later */}
      <pre className="flex-grow overflow-auto whitespace-pre-wrap">
        No output yet...
      </pre>
    </div>
  );
};

export default OutputPanel; 
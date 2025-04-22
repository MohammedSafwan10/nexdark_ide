import React from 'react';

interface ProblemsPanelProps {
  isVisible: boolean;
  // TODO: Add props for problems data (e.g., diagnostics from LSP)
}

const ProblemsPanel: React.FC<ProblemsPanelProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  // Placeholder data
  const totalErrors = 0;
  const totalWarnings = 0;

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-sm">
      {/* Header (Filter, Collapse) */}
      <div className="flex justify-between items-center px-2 py-1 border-b border-[var(--border-subtle)] flex-shrink-0">
        <span className="text-xs text-[var(--text-primary)] font-medium">
          Problems ({totalErrors + totalWarnings})
        </span>
        {/* TODO: Add Filter button/input */}
        {/* TODO: Add Collapse All button */}
      </div>

      {/* Problems List Area */}
      <div className="flex-grow overflow-auto p-2">
        {totalErrors === 0 && totalWarnings === 0 ? (
          <div className="text-center text-xs mt-4">No problems have been detected in the workspace.</div>
        ) : (
          <div>
            {/* TODO: Render actual problems grouped by file */}
            {/* Example structure: */}
            {/* <div className="mb-2">
              <div className="font-medium text-[var(--text-primary)] text-xs">src/App.tsx</div>
              <ul className="pl-4 text-xs">
                <li className="flex items-center gap-1"><VscError className="text-[var(--accent-error)]"/> [ts] Some error message... (line 10)</li>
                <li className="flex items-center gap-1"><VscWarning className="text-[var(--accent-warning)]"/> [eslint] Some warning... (line 25)</li>
              </ul>
            </div> */}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemsPanel; 
import React from 'react';

interface BottomPanelHeaderProps {
  views: { id: string; title: string }[];
  activeViewId: string;
  onSelectView: (viewId: string) => void;
  // Optional props for actions like Close Panel, Maximize, etc.
}

const BottomPanelHeader: React.FC<BottomPanelHeaderProps> = ({ 
  views,
  activeViewId,
  onSelectView,
}) => {
  return (
    <div className="flex items-center justify-between h-6 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 flex-shrink-0">
      {/* Tabs */}
      <div className="flex items-center gap-1 text-[11px]">
        {views.map(view => (
          <button
            key={view.id}
            onClick={() => onSelectView(view.id)}
            className={`
              px-1 py-0 rounded-sm
              ${activeViewId === view.id
                ? 'text-[var(--text-primary)] font-medium border-b border-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
              transition-colors duration-150 flex items-center h-full
            `}
          >
            {view.title}
          </button>
        ))}
      </div>

      {/* Action Buttons (Placeholder) */}
      <div className="flex items-center gap-1">
        {/* Add buttons like Maximize, Close, etc. here later */}
        {/* Example:
        <button title="Maximize Panel" className="p-1 rounded hover:bg-[var(--button-secondary-hover-bg)]">
          <VscChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
        <button title="Close Panel" className="p-1 rounded hover:bg-[var(--button-secondary-hover-bg)]">
          <VscClose className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
        */}
      </div>
    </div>
  );
};

export default BottomPanelHeader; 
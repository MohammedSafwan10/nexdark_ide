import { useState, useRef, useEffect } from 'react';
import { 
  VscClose
} from 'react-icons/vsc';

// Command interface
export interface Command {
  id: string;
  title: string;
  category?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  execute: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [searchText, setSearchText] = useState('');
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  
  // Filter commands based on search text
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredCommands(commands);
      return;
    }
    
    const lowerSearch = searchText.toLowerCase();
    
    // Score and filter commands
    const scoredCommands = commands
      .map(command => {
        const titleScore = command.title.toLowerCase().includes(lowerSearch) ? 2 : 0;
        const categoryScore = command.category?.toLowerCase().includes(lowerSearch) ? 1 : 0;
        const score = titleScore + categoryScore;
        return { command, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))
      .map(({ command }) => command);
    
    setFilteredCommands(scoredCommands);
    setSelectedIndex(0); // Reset selection when search changes
  }, [searchText, commands]);
  
  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchText('');
    }
  }, [isOpen]);
  
  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && listRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex]);
  
  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };
  
  // Execute a command and close palette
  const executeCommand = (command: Command) => {
    command.execute();
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed top-[10vh] left-1/2 transform -translate-x-1/2 z-50"
    >
      <div 
        className="w-[560px] max-w-[calc(100vw-32px)] bg-[var(--bg-secondary)] shadow-xl rounded-md overflow-hidden flex flex-col border border-[var(--border-medium)]"
      >
        {/* Search input */}
        <div className="flex items-center px-2 border-b border-[var(--border-subtle)]">
          <span className="text-[var(--text-secondary)] font-semibold text-lg mr-1">{`>`}</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
            placeholder="Type a command or search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={onClose}
            title="Close"
          >
            <VscClose className="w-5 h-5" />
          </button>
        </div>
        
        {/* Command list */}
        <div 
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto"
        >
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-secondary)]">
              No commands found
            </div>
          ) : (
            <div>
              {filteredCommands.map((command, index) => (
                <div
                  key={command.id}
                  ref={index === selectedIndex ? selectedItemRef : undefined}
                  className={`flex items-center p-2 hover:bg-[var(--sidebar-item-hover)] cursor-pointer ${
                    index === selectedIndex ? 'bg-[var(--sidebar-item-hover)]' : ''
                  }`}
                  onClick={() => executeCommand(command)}
                >
                  <div className="w-6 h-6 flex items-center justify-center mr-2 text-[var(--accent-secondary)]">
                    {command.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-[var(--text-primary)]">{command.title}</div>
                    {command.category && (
                      <div className="text-xs text-[var(--text-secondary)]">{command.category}</div>
                    )}
                  </div>
                  {command.shortcut && (
                    <div className="text-xs text-[var(--text-secondary)] px-2 py-0.5 bg-[var(--bg-tertiary)] rounded">
                      {command.shortcut}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette; 
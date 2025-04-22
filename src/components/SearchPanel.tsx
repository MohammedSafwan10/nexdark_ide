import { useState, useRef, useEffect, useCallback } from 'react';
import {
  VscCaseSensitive, VscRegex, VscNewFile, 
  VscCollapseAll, VscReplace, VscWholeWord, 
  VscHistory, VscSettingsGear, VscChevronDown, VscChevronRight,
  VscRefresh, VscClose, VscReplaceAll
} from 'react-icons/vsc';
import type { SearchResult, SearchMatch } from '../types/electron';
import path from 'path-browserify';

interface SearchPanelProps {
  rootFolder: string | null;
  onSelectResult: (filePath: string, line: number, column: number) => void;
  isVisible: boolean;
}

const SearchPanel: React.FC<SearchPanelProps> = ({ rootFolder, onSelectResult, isVisible }) => {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  
  const [includePattern, setIncludePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isReplaceVisible, setIsReplaceVisible] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  
  // Focus search input when panel becomes visible
  useEffect(() => {
    if (isVisible && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isVisible]);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!rootFolder || !searchText.trim()) {
      return;
    }
    setIsSearching(true);
    setError(null);
    setResults([]);
    try {
      const searchResults = await window.electronAPI.searchInFiles(
        rootFolder, 
        searchText,
        includePattern || undefined,
        excludePattern || undefined
        // Pass search options in comments until backend supports them
        // { caseSensitive, useRegex, wholeWord }
      );
      if (searchResults.length === 0) {
        setError('No results found');
      } else {
        setResults(searchResults);
        const newExpandedState: Record<string, boolean> = {};
        searchResults.forEach(result => newExpandedState[result.filePath] = true);
        setExpandedFiles(newExpandedState);
      }
    } catch (err) {
      setError('Error performing search');
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [rootFolder, searchText, includePattern, excludePattern]);

  // Preserve search state when switching between tabs
  useEffect(() => {
    if (isVisible && rootFolder && searchText.trim() && results.length === 0 && !isSearching && !error) {
      handleSearch();
    }
  }, [isVisible, rootFolder, handleSearch, searchText, results.length, isSearching, error]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleFileClick = (filePath: string) => {
    setExpandedFiles(prev => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  const handleResultClick = (result: SearchResult, match: SearchMatch) => {
    onSelectResult(result.filePath, match.line, match.startColumn);
  };

  const handleClearResults = () => {
    setResults([]);
    setError(null);
  };

  const handleExpandCollapseAll = (expand: boolean) => {
    const newExpandedState: Record<string, boolean> = {};
    if (expand) {
      results.forEach(result => newExpandedState[result.filePath] = true);
    }
    setExpandedFiles(newExpandedState);
  };

  // Helper to highlight matched text
  const renderHighlightedText = (match: SearchMatch) => {
    const before = match.lineContent.substring(0, match.startColumn - 1);
    const highlighted = match.lineContent.substring(match.startColumn - 1, match.endColumn - 1);
    const after = match.lineContent.substring(match.endColumn - 1);
    return <><span className="opacity-70">{before}</span><span className="bg-[var(--search-highlight)]">{highlighted}</span><span className="opacity-70">{after}</span></>;
  };

  const renderSearchResults = () => {
    if (isSearching) return null;
    if (error) {
      return <div className="px-3 py-1 text-sm text-[var(--text-error)]">{error}</div>;
    }
    if (results.length === 0) {
      return null;
    }

    const totalMatches = results.reduce((count, file) => count + file.matches.length, 0);

    return (
      <div className="overflow-auto flex-1 text-sm">
        {/* Results Header */}
        <div className="flex justify-between items-center px-2 py-1 border-b border-[var(--panel-border)] text-[var(--text-secondary)] text-xs">
          <span>
            {totalMatches} {totalMatches === 1 ? "match" : "matches"} in {results.length} {results.length === 1 ? "file" : "files"}
          </span>
          <div className="flex gap-1">
            <button 
              onClick={() => handleExpandCollapseAll(true)} 
              title="Expand All" 
              className="p-1 hover:bg-[var(--button-secondary-hover-bg)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <VscChevronDown className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => handleExpandCollapseAll(false)} 
              title="Collapse All" 
              className="p-1 hover:bg-[var(--button-secondary-hover-bg)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <VscCollapseAll className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={handleClearResults} 
              title="Clear Search Results" 
              className="p-1 hover:bg-[var(--button-secondary-hover-bg)] rounded transition-colors ml-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <VscClose className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="text-[var(--text-primary)]">
          {results.map((result) => (
            <div key={result.filePath} className="mb-0.5">
              <div 
                className="flex items-center gap-1 px-1 py-[1px] cursor-pointer hover:bg-[var(--list-hover-bg)] rounded mx-1 text-xs"
                onClick={() => handleFileClick(result.filePath)}
              >
                {expandedFiles[result.filePath] ? 
                  <VscChevronDown className="w-4 h-4 text-[var(--text-secondary)]" /> : 
                  <VscChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                }
                <VscNewFile className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                <span className="truncate flex-1 text-[var(--text-primary)]">
                  {path.basename(result.filePath)} 
                </span>
                <span className="text-xs text-[var(--text-secondary)] bg-[var(--badge-bg)] px-1.5 py-0.5 rounded">
                  {result.matches.length}
                </span>
              </div>
              
              {expandedFiles[result.filePath] && (
                <div className="pl-5">
                  {result.matches.map((match, index) => (
                    <div 
                      key={`${match.line}-${index}`}
                      className="px-2 py-[1px] cursor-pointer hover:bg-[var(--list-hover-bg)] flex rounded mx-1 text-xs"
                      onClick={() => handleResultClick(result, match)}
                    >
                      <span className="text-[var(--text-secondary)] text-xs w-10 flex-shrink-0 text-right pr-2 font-mono">
                        {match.line}:
                      </span>
                      <span className="text-[var(--text-primary)] whitespace-pre overflow-hidden text-ellipsis">
                        {renderHighlightedText(match)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${!isVisible ? 'hidden' : ''} bg-[var(--bg-secondary)]`}>
      {/* Panel Header */}
      <div className="flex justify-between items-center px-2 py-1 border-b border-[var(--border-subtle)] flex-shrink-0">
        <h2 className="text-xs font-semibold uppercase text-[var(--text-secondary)] tracking-wide">Search</h2>
        <div className="flex gap-1">
          <button 
            className="p-1 hover:bg-[var(--button-secondary-hover-bg)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title="Refresh" 
            onClick={handleSearch}
          >
            <VscRefresh className="w-4 h-4" />
          </button>
          <button 
            className="p-1 hover:bg-[var(--button-secondary-hover-bg)] rounded transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title="Clear"
            onClick={handleClearResults}
          >
            <VscClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Replace Section */}
      <div className="border-b border-[var(--border-subtle)] p-2 flex-shrink-0">
        {/* Search Row */}
        <div className="flex mb-1 items-center">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              className="w-full bg-[var(--input-bg)] text-[var(--input-fg)] border border-[var(--input-border)] 
                      px-2 py-1 rounded focus:border-[var(--input-focus-border)] focus:outline-none text-sm"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search"
            />
          </div>
          
          <button 
            className={`ml-1 p-1 rounded ${isReplaceVisible ? 'bg-[var(--button-active-bg)] text-[var(--button-active-fg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--button-secondary-hover-bg)]'}`}
            onClick={() => setIsReplaceVisible(!isReplaceVisible)}
            title="Toggle Replace"
          >
            <VscReplace className="w-4 h-4" />
          </button>
        </div>
        
        {/* Replace Row (conditionally rendered) */}
        {isReplaceVisible && (
          <div className="flex mb-1 items-center">
            <div className="relative flex-1">
              <input
                ref={replaceInputRef}
                type="text"
                className="w-full bg-[var(--input-bg)] text-[var(--input-fg)] border border-[var(--input-border)] 
                        px-2 py-1 rounded focus:border-[var(--input-focus-border)] focus:outline-none text-sm"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace"
              />
            </div>
            
            <button 
              className="ml-1 p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--button-secondary-hover-bg)] disabled:opacity-50"
              title="Replace All"
              disabled={!results.length || !replaceText}
            >
              <VscReplaceAll className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Search Controls */}
        <div className="flex gap-1 mt-1">
          <button 
            className={`p-1 rounded ${caseSensitive ? 'bg-[var(--button-active-bg)] text-[var(--button-active-fg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--button-secondary-hover-bg)]'}`}
            onClick={() => setCaseSensitive(!caseSensitive)}
            title="Match Case"
          >
            <VscCaseSensitive className="w-4 h-4" />
          </button>
          
          <button 
            className={`p-1 rounded ${wholeWord ? 'bg-[var(--button-active-bg)] text-[var(--button-active-fg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--button-secondary-hover-bg)]'}`}
            onClick={() => setWholeWord(!wholeWord)}
            title="Match Whole Word"
          >
            <VscWholeWord className="w-4 h-4" />
          </button>
          
          <button 
            className={`p-1 rounded ${useRegex ? 'bg-[var(--button-active-bg)] text-[var(--button-active-fg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--button-secondary-hover-bg)]'}`}
            onClick={() => setUseRegex(!useRegex)}
            title="Use Regular Expression"
          >
            <VscRegex className="w-4 h-4" />
          </button>
          
          {isSearching && (
            <span className="text-xs text-[var(--text-secondary)] flex items-center ml-2">
              <VscRefresh className="w-3.5 h-3.5 animate-spin mr-1" /> Searching...
            </span>
          )}
        </div>
        
        {/* Filters */}
        <div className="space-y-2">
          {/* Include Pattern */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[var(--text-secondary)]">files to include</label>
              <button 
                className="text-[var(--icon-fg)] hover:bg-[var(--button-hover-bg)] p-0.5 rounded" 
                title="Use History"
              >
                <VscHistory className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              className="w-full bg-[var(--input-bg)] text-[var(--input-fg)] border-2 border-[var(--input-border)] 
                p-3 pl-4 pr-3 rounded-md focus:border-[var(--input-focus-border)] focus:outline-none text-base"
              style={{ height: '42px', minHeight: '42px' }}
              value={includePattern}
              onChange={(e) => setIncludePattern(e.target.value)}
              placeholder="e.g. *.ts, src/**/*.{ts,tsx}"
            />
          </div>
          
          {/* Exclude Pattern */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[var(--text-secondary)]">files to exclude</label>
              <button 
                className="text-[var(--icon-fg)] hover:bg-[var(--button-hover-bg)] p-0.5 rounded" 
                title="Use Settings"
              >
                <VscSettingsGear className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              className="w-full bg-[var(--input-bg)] text-[var(--input-fg)] border-2 border-[var(--input-border)] 
                p-3 pl-4 pr-3 rounded-md focus:border-[var(--input-focus-border)] focus:outline-none text-base"
              style={{ height: '42px', minHeight: '42px' }}
              value={excludePattern}
              onChange={(e) => setExcludePattern(e.target.value)}
              placeholder="e.g. node_modules, *.test.ts"
            />
          </div>
        </div>
      </div>

      {/* Results Section */}
      {renderSearchResults()}
      
      {/* Empty State */}
      {!isSearching && !error && results.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          {!rootFolder ? (
            <p className="text-sm text-[var(--text-secondary)]">Open a folder to search.</p>
          ) : searchText ? (
            <p className="text-sm text-[var(--text-secondary)]">No results found.</p>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Type to search in files.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPanel;
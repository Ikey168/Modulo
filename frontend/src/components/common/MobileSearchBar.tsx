import React, { useState, useRef, useEffect } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { useTouchDevice } from '../../hooks/useMobileInteractions';
import MobileOptimizedButton from './MobileOptimizedButton';
import MobileOptimizedInput from './MobileOptimizedInput';
import './MobileSearchBar.css';

interface MobileSearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  suggestions?: string[];
  maxSuggestions?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const MobileSearchBar: React.FC<MobileSearchBarProps> = ({
  placeholder = 'Search...',
  value,
  onChange,
  onSearch,
  onClear,
  suggestions = [],
  maxSuggestions = 5,
  className = '',
  disabled = false,
  autoFocus = false,
}) => {
  const { isMobile } = useResponsive();
  const isTouchDevice = useTouchDevice();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on current input
  const filteredSuggestions = suggestions
    .filter(suggestion => 
      suggestion.toLowerCase().includes(value.toLowerCase()) && 
      suggestion.toLowerCase() !== value.toLowerCase()
    )
    .slice(0, maxSuggestions);

  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  // Handle clicks outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        if (isMobile) {
          setIsExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile]);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setShowSuggestions(newValue.length > 0 && filteredSuggestions.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  const handleInputFocus = () => {
    if (isMobile) {
      setIsExpanded(true);
    }
    if (value && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for suggestion clicks
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredSuggestions.length === 0) {
      if (e.key === 'Enter' && onSearch) {
        onSearch(value);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          selectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
        } else if (onSearch) {
          onSearch(value);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    if (onSearch) {
      onSearch(suggestion);
    }
  };

  const handleClear = () => {
    onChange('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    if (onClear) {
      onClear();
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSearch = () => {
    if (onSearch) {
      onSearch(value);
    }
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  return (
    <div 
      ref={containerRef}
      className={`mobile-search-bar ${className} ${isExpanded ? 'expanded' : ''} ${isMobile ? 'mobile' : ''}`}
    >
      {/* Mobile expanded header */}
      {isMobile && isExpanded && (
        <div className="mobile-search-header">
          <MobileOptimizedButton
            variant="ghost"
            size="touch"
            onClick={handleCollapse}
            aria-label="Close search"
            className="back-button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </MobileOptimizedButton>
          <span className="search-title">Search</span>
        </div>
      )}

      {/* Search input container */}
      <div className="search-input-container">
        <div className="search-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </div>

        <MobileOptimizedInput
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="search-input"
          variant="filled"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
        />

        {/* Clear button */}
        {value && (
          <MobileOptimizedButton
            variant="ghost"
            size="small"
            onClick={handleClear}
            aria-label="Clear search"
            className="clear-button"
            tabIndex={-1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </MobileOptimizedButton>
        )}

        {/* Search button */}
        {onSearch && !isTouchDevice && (
          <MobileOptimizedButton
            variant="primary"
            size="small"
            onClick={handleSearch}
            aria-label="Search"
            className="search-button"
            disabled={!value.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </MobileOptimizedButton>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div 
          className="suggestions-dropdown"
          role="listbox"
          aria-label="Search suggestions"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={suggestion}
              className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
              role="option"
              aria-selected={index === selectedSuggestionIndex}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              <div className="suggestion-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
              <span className="suggestion-text">{suggestion}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mobile overlay */}
      {isMobile && isExpanded && (
        <div 
          className="mobile-overlay" 
          onClick={handleCollapse}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default MobileSearchBar;

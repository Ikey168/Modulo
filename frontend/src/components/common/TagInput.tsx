import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
}

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: Tag[];
  placeholder?: string;
  maxTags?: number;
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  suggestions = [],
  placeholder = "Add tags...",
  maxTags = 10
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Tag[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = suggestions.filter(
        suggestion =>
          suggestion.name.toLowerCase().includes(inputValue.toLowerCase()) &&
          !tags.includes(suggestion.name)
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [inputValue, suggestions, tags]);

  const addTag = (tagName: string) => {
    const trimmedTag = tagName.trim();
    if (
      trimmedTag &&
      !tags.includes(trimmedTag) &&
      tags.length < maxTags
    ) {
      onChange([...tags, trimmedTag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleSuggestionClick = (suggestion: Tag) => {
    addTag(suggestion.name);
  };

  return (
    <div className="relative w-full">
      <div className="flex min-h-[2.5rem] cursor-text flex-wrap items-center gap-2 rounded-md border border-border-strong bg-surface-2 p-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-sm font-medium text-primary-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-primary-foreground transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60"
                aria-label={`Remove ${tag} tag`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => inputValue && setShowSuggestions(filteredSuggestions.length > 0)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="min-w-[120px] flex-1 border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          disabled={tags.length >= maxTags}
        />
      </div>

      {showSuggestions && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-surface-2 shadow-md">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="block w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-3 focus:bg-surface-3 focus:outline-none"
            >
              {suggestion.name}
            </button>
          ))}
        </div>
      )}

      {tags.length >= maxTags && (
        <div className="mt-2 text-xs text-warning">
          Maximum {maxTags} tags allowed
        </div>
      )}
    </div>
  );
};

export default TagInput;

import { useState, useRef, useEffect } from 'preact/hooks';
import { formStyles } from '../styles/modal';

const SelectWrapper = formStyles.selectWrapper;
const Select = formStyles.select;
const SelectPlaceholder = formStyles.selectPlaceholder;
const SelectValue = formStyles.selectValue;
const Dropdown = formStyles.dropdown;
const SearchInput = formStyles.searchInput;
const Option = formStyles.option;

export interface SelectOption {
  value: string | number | null;
  label: string;
  indent?: boolean;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  error = false,
  disabled = false,
  searchPlaceholder = 'Search...',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search query
  const filteredOptions = searchQuery
    ? options.filter((option) =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Get selected option label
  const selectedOption = options.find((opt) => opt.value === value);
  const selectedLabel = selectedOption?.label;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (isOpen) {
        setSearchQuery('');
      }
    }
  };

  const handleOptionClick = (optionValue: string | number | null) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <SelectWrapper ref={wrapperRef}>
      <Select
        className={`${isOpen ? 'open' : ''} ${isOpen ? 'focused' : ''} ${error ? 'error' : ''}`}
        onClick={handleToggle}
      >
        {selectedLabel ? (
          <SelectValue>{selectedLabel}</SelectValue>
        ) : (
          <SelectPlaceholder>{placeholder}</SelectPlaceholder>
        )}
        <i class="fas fa-chevron-down" />
      </Select>
      {isOpen && (
        <Dropdown>
          <SearchInput
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            placeholder={searchPlaceholder}
            onInput={(e: any) => setSearchQuery((e.target as HTMLInputElement).value)}
            onClick={(e: any) => e.stopPropagation()}
          />
          {filteredOptions.length === 0 ? (
            <Option style={{ cursor: 'default', opacity: 0.6 }}>No results found</Option>
          ) : (
            filteredOptions.map((option) => (
              <Option
                key={String(option.value)}
                className={`${option.value === value ? 'selected' : ''} ${option.indent ? 'indent' : ''}`}
                onClick={() => handleOptionClick(option.value)}
              >
                {option.label}
              </Option>
            ))
          )}
        </Dropdown>
      )}
    </SelectWrapper>
  );
}

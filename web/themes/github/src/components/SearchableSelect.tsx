import { useState, useRef, useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { formStyles } from './modal';

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
  const [dropdownStyle, setDropdownStyle] = useState<any>({ position: 'fixed', zIndex: 10001 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      const target = event.target as Node;
      const isOutsideWrapper = wrapperRef.current && !wrapperRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);

      if (isOutsideWrapper && isOutsideDropdown) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Update position when dropdown opens
  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 10001,
      });
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      if (!isOpen && wrapperRef.current) {
        // Calculate position immediately before opening
        const rect = wrapperRef.current.getBoundingClientRect();
        setDropdownStyle({
          position: 'fixed',
          top: `${rect.bottom + 4}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          zIndex: 10001,
        });
      }
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

  const dropdownContent = isOpen && (
    <div ref={dropdownRef}>
      <Dropdown style={dropdownStyle}>
        <SearchInput
          autoFocus
          type="text"
          value={searchQuery}
          placeholder={searchPlaceholder}
          onInput={(e: any) => {
            const target = e.target as HTMLInputElement;
            setSearchQuery(target.value);
          }}
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
    </div>
  );

  return (
    <>
      <div ref={wrapperRef}>
        <SelectWrapper>
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
        </SelectWrapper>
      </div>
      {isOpen && createPortal(dropdownContent, document.body)}
    </>
  );
}

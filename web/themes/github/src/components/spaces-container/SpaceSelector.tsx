import { SearchableSelect } from './SearchableSelect';
import { buildSpaceOptions } from '@core/models/space/utils';

interface SpaceSelectorProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  excludeSpaceId?: number; // For update modal - exclude current space and its descendants
  showAllDepths?: boolean; // If true, show all depth levels (for move). If false, only show spaces that can be parents (for create/update)
}

export function SpaceSelector({
  value,
  onChange,
  placeholder = 'None (Root Space)',
  error = false,
  disabled = false,
  excludeSpaceId,
  showAllDepths = false
}: SpaceSelectorProps) {
  return (
    <SearchableSelect
      options={buildSpaceOptions(excludeSpaceId, showAllDepths)}
      value={value}
      onChange={(value) => onChange(value as number | null)}
      placeholder={placeholder}
      searchPlaceholder="Search spaces..."
      error={error}
      disabled={disabled}
    />
  );
}

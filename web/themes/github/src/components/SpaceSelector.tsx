import { SearchableSelect, type SelectOption } from './SearchableSelect';
import { spaces } from '@core/state';

interface SpaceSelectorProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  excludeSpaceId?: number; // For move modal - exclude current space
  showAllDepths?: boolean; // If true, show all depth levels (for move). If false, only show spaces that can be parents (for create)
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
  // Build parent space options with hierarchy
  const buildSpaceOptions = (): SelectOption[] => {
    const allSpaces = spaces.value;
    const options: SelectOption[] = [{ value: null, label: 'None (Root Space)' }];

    // Get root spaces (no parent)
    const rootSpaces = allSpaces.filter((s) => s.parent_id === null && s.id !== excludeSpaceId);

    // Add root spaces and their children
    rootSpaces.forEach((rootSpace) => {
      options.push({
        value: rootSpace.id,
        label: rootSpace.name,
      });

      // Add level 1 children with indent
      const children = allSpaces.filter((s) => s.parent_id === rootSpace.id && s.id !== excludeSpaceId);
      children.forEach((child) => {
        options.push({
          value: child.id,
          label: `${rootSpace.name} / ${child.name}`,
          indent: true,
        });

        // If showAllDepths is true, also add level 2 children (grandchildren)
        if (showAllDepths) {
          const grandchildren = allSpaces.filter((s) => s.parent_id === child.id && s.id !== excludeSpaceId);
          grandchildren.forEach((grandchild) => {
            options.push({
              value: grandchild.id,
              label: `${rootSpace.name} / ${child.name} / ${grandchild.name}`,
              indent: true,
            });
          });
        }
      });
    });

    return options;
  };

  return (
    <SearchableSelect
      options={buildSpaceOptions()}
      value={value}
      onChange={(value) => onChange(value as number | null)}
      placeholder={placeholder}
      searchPlaceholder="Search spaces..."
      error={error}
      disabled={disabled}
    />
  );
}

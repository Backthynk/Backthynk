import { spaces } from '@core/state';
import { spacesContainerStyles } from '../../styles/spaces-container';
import { SpaceItem } from './SpaceItem';
import type { Space } from '@core/api';
import type { SortPreference } from './SortControls';

const SpacesList = spacesContainerStyles.spacesList;

interface SpaceContainerProps {
  sortPref: SortPreference;
}

export function SpaceContainer({ sortPref }: SpaceContainerProps) {
  const spacesList = spaces.value;

  // Sort spaces function with stable sorting
  const sortSpaces = (spacesArray: Space[]): Space[] => {
    const sorted = [...spacesArray];

    sorted.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortPref.field) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'posts':
          aValue = a.recursive_post_count || 0;
          bValue = b.recursive_post_count || 0;
          break;
        case 'created':
          aValue = (a as any).created || 0;
          bValue = (b as any).created || 0;
          break;
        default:
          return 0;
      }

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      else if (aValue > bValue) comparison = 1;

      // Use ID as tiebreaker for stable sort
      if (comparison === 0) {
        comparison = a.id - b.id;
      }

      return sortPref.ascending ? comparison : -comparison;
    });

    return sorted;
  };

  const rootSpaces = sortSpaces(spacesList.filter((space) => space.parent_id === null));

  const showPostCount = sortPref.field === 'posts';

  const renderSpace = (space: Space, depth = 0, parentRecursive = false) => {
    const children = sortSpaces(spacesList.filter((s) => s.parent_id === space.id));

    return (
      <SpaceItem
        key={space.id}
        space={space}
        depth={depth}
        sortedChildren={children}
        renderSpace={renderSpace}
        showPostCount={showPostCount}
        parentRecursive={parentRecursive}
      />
    );
  };

  return (
    <SpacesList>
      {rootSpaces.map((space) => renderSpace(space))}
    </SpacesList>
  );
}

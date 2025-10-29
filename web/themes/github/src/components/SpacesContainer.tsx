import { useState, useEffect } from 'preact/hooks';
import { spacesContainerStyles } from '../styles/spaces-container';
import { SpaceContainer } from './spaces-container/SpaceContainer';
import { SortControls, type SortField, type SortPreference } from './spaces-container/SortControls';
import { CreateSpaceModal } from './CreateSpaceModal';
import { appSettings } from '@core/state';
import { activityContainerHeightRem, shouldShowActivity } from '@core/state/activity';

const Container = spacesContainerStyles.container;
const Header = spacesContainerStyles.header;
const AddButton = spacesContainerStyles.addButton;

const SORT_STORAGE_KEY = 'spaceSortPref';

// Approximate heights in rem for calculation
const FOOTER_HEIGHT = 7; // ~9rem for footer links
const GAP = 1; // 1rem gap between components
const PADDING = 2; // 2rem total padding (1rem top + 1rem bottom)

export function SpacesContainer() {
  // Load sort preference from localStorage
  const loadSortPreference = (): SortPreference => {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : { field: 'name', ascending: true };
  };

  const [sortPref, setSortPref] = useState<SortPreference>(loadSortPreference());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Save sort preference to localStorage
  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sortPref));
  }, [sortPref]);

  const handleSort = (field: SortField) => {
    setSortPref(prev => ({
      field,
      ascending: prev.field === field ? !prev.ascending : true
    }));
  };

  // Calculate max height based on whether activity is enabled
  const settings = appSettings.value;
  const activityEnabled = settings.activityEnabled;

  // Calculate total height to subtract from viewport
  let subtractHeight = PADDING + FOOTER_HEIGHT + GAP; // Base: padding + footer + 1 gap
  if (activityEnabled) {
    subtractHeight += (shouldShowActivity.value ? activityContainerHeightRem.value : 0) + GAP; // Add activity height + another gap
  }

  const calculatedMaxHeight = `calc(100vh - ${subtractHeight}rem)`;
  const maxHeight = `min(${calculatedMaxHeight}, 800px)`;

  return (
    <>
      <Container style={{ maxHeight }}>
        <Header>
          <h2>Spaces</h2>
          <AddButton onClick={() => setIsCreateModalOpen(true)}>
            <i class="fas fa-plus" />
          </AddButton>
        </Header>
        <SpaceContainer sortPref={sortPref} />
        <SortControls sortPref={sortPref} onSort={handleSort} />
      </Container>

      <CreateSpaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          // Modal will handle closing itself, we could add a toast notification here
          console.log('Space created successfully');
        }}
      />
    </>
  );
}

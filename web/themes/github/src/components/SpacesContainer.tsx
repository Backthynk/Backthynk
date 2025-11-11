import { useState, useEffect, useRef } from 'preact/hooks';
import { spacesContainerStyles } from '../styles/spaces-container';
import { SpaceContainer } from './spaces-container/SpaceContainer';
import { SortControls, type SortField, type SortPreference } from './spaces-container/SortControls';
import { CreateSpaceModal } from './spaces-container/CreateSpaceModal';
/*
disabled for now : 11.11.2025
import { ProfileHeader, profileData } from './profile';
*/
import type { Space } from '@core/api';

const Container = spacesContainerStyles.container;
const Header = spacesContainerStyles.header;
const AddButton = spacesContainerStyles.addButton;

const SORT_STORAGE_KEY = 'spaceSortPref';

// Approximate heights in rem for calculation
const GAP = 1; // 1rem gap between profile and spaces container (matching companion panel)
const PADDING = 2; // 2rem total padding (1rem top + 1rem bottom)

interface SpacesContainerProps {
  currentSpace: Space | null;
}

export function SpacesContainer({ currentSpace }: SpacesContainerProps) {
  // Load sort preference from localStorage
  const loadSortPreference = (): SortPreference => {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : { field: 'name', ascending: true };
  };

  const [sortPref, setSortPref] = useState<SortPreference>(loadSortPreference());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [profileHeight, setProfileHeight] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);

  // Save sort preference to localStorage
  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sortPref));
  }, [sortPref]);

  // Measure profile height dynamically
  useEffect(() => {
    /* disabled for now : 11.11.2025
    if (profileRef.current) {
      const height = profileRef.current.offsetHeight;
      // Convert px to rem (assuming 16px = 1rem)
      setProfileHeight(height / 16);
    }
    */
  }, []);

  const handleSort = (field: SortField) => {
    setSortPref(prev => ({
      field,
      ascending: prev.field === field ? !prev.ascending : true
    }));
  };

  // Calculate max height based on dynamic profile height
  const subtractHeight = PADDING + profileHeight + GAP * 3;
  const calculatedMaxHeight = `calc(100vh - ${subtractHeight}rem)`;
  const maxHeight = `min(${calculatedMaxHeight}, 800px)`;

  return (
    <>
      {/* Disabled for now : 11.11.2025
      <div ref={profileRef}>
        <ProfileHeader profile={profileData} />
      </div>
      */}
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
        currentSpace={currentSpace}
      />
    </>
  );
}

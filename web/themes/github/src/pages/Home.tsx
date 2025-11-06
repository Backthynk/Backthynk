import { useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { spaces, loadExpandedSpaces, loadRecursiveModes, isRecursiveMode, isEligibleForRecursive, currentSpace as currentSpaceSignal } from '@core/state';
import { fetchSpaces as fetchSpacesApi } from '@core/api';
import { generateSlug } from '@core/utils';
import { expandParentSpaces, toggleRecursiveMode, selectSpace } from '@core/actions/spaceActions';
import { Layout } from '../components/Layout';
import { SpacesContainer } from '../components/SpacesContainer';
import { FooterLinks } from '../components/spaces-container';
import { ActivityTracker } from '../components/activity';
import { Timeline } from '../components/Timeline';
import { CompanionPanel } from '../components/companion';
import { layoutStyles } from '../styles/layout';
import { keyboard } from '../config';
import type { Space } from '@core/api';

const Container = layoutStyles.container;
const Grid = layoutStyles.grid;
const LeftPanel = layoutStyles.leftPanel;
const Main = layoutStyles.main;
const Companion = layoutStyles.companion;

export function Home() {
  const route = useRoute();

  // Sync URL with currentSpace state
  useEffect(() => {
    // Find space from URL path
    const findSpaceByPath = (path: string): Space | null => {
      if (path === '/') return null;

      const pathSegments = path.split('/').filter(Boolean);
      const spacesList = spaces.value;

      let foundSpace: Space | null = null;
      let currentParentId: number | null = null;

      for (const segment of pathSegments) {
        const found = spacesList.find(s =>
          generateSlug(s.name) === segment &&
          s.parent_id === currentParentId
        );

        if (!found) return null;

        foundSpace = found;
        currentParentId = found.id;
      }

      return foundSpace;
    };

    const spaceFromUrl = findSpaceByPath(route.path);

    // Update state to match URL
    if (spaceFromUrl?.id !== currentSpaceSignal.value?.id) {
      selectSpace(spaceFromUrl);
    }
  }, [route.path, spaces.value]);

  // Use the signal value, not URL-derived value
  const currentSpace = currentSpaceSignal.value;

  useEffect(() => {
    // Load expanded spaces from localStorage
    loadExpandedSpaces();

    // Only fetch spaces if not already hydrated from SSR
    if (spaces.value.length === 0) {
      fetchSpacesApi().then((fetchedSpaces) => {
        spaces.value = fetchedSpaces;
        // Load recursive modes after spaces are loaded
        loadRecursiveModes();
      });
    } else {
      // Load recursive modes if spaces are already loaded
      loadRecursiveModes();
    }
  }, []);

  // Auto-expand and scroll when currentSpace changes
  useEffect(() => {
    if (currentSpace) {
      expandParentSpaces(currentSpace.id);

      // Scroll to the selected space after a short delay to allow DOM to update
      setTimeout(() => {
        const selectedElement = document.querySelector('.selected');
        if (selectedElement) {
          selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  }, [currentSpace]);

  // Keyboard handler for 'R' key to toggle recursive mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const config = keyboard.toggleRecursive;
      // Only toggle if configured key is pressed with required modifiers and no input is focused
      if (
        (e.key.toLowerCase() === config.key.toLowerCase()) &&
        e.ctrlKey === config.requireCtrl &&
        e.altKey === config.requireAlt &&
        e.metaKey === config.requireMeta &&
        e.shiftKey === config.requireShift
      ) {
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement instanceof HTMLSelectElement ||
          (activeElement as HTMLElement)?.isContentEditable;

        if (!isInputFocused && isEligibleForRecursive(currentSpace?.id)) {
          e.preventDefault();
          toggleRecursiveMode(currentSpace!.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSpace]);

  return (
    <Layout>
      <Container>
        <Grid>
          <LeftPanel>
            <div style={{
              position: 'sticky',
              top: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <SpacesContainer currentSpace={currentSpace} />
              <ActivityTracker currentSpace={currentSpace} />
              <FooterLinks />
            </div>
          </LeftPanel>

          <Main>
            <Timeline
              spaceId={currentSpace?.id || null}
              recursive={currentSpace ? isRecursiveMode(currentSpace.id) : false}
            />
          </Main>

          <Companion>
            <CompanionPanel space={currentSpace} />
          </Companion>
        </Grid>
      </Container>
    </Layout>
  );
}

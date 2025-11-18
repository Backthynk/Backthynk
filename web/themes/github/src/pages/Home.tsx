import { useEffect, useRef } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { spaces, isRecursiveMode, isEligibleForRecursive, currentSpace as currentSpaceSignal, imageViewerState, closeImageViewer } from '@core/state';
import { generateSlug } from '@core/utils';
import { expandParentSpaces, toggleRecursiveMode, selectSpace } from '@core/actions/spaceActions';
import { Layout } from '../components/Layout';
import { SpacesContainer } from '../components/spaces-container/SpacesContainer';
import { FooterLinks, useContainerHeight } from '../components/spaces-container';
import { CreatePostButton } from '../components/post';
import { ActivityTracker } from '../components/activity';
import { Timeline } from '../components/Timeline';
import { CompanionPanel } from '../components/companion';
import { ImageViewer } from '@core/components/ImageViewer';
import { layoutStyles } from '../styles/layout';
import { keyboard } from '../config';
import type { Space } from '@core/api';

const Container = layoutStyles.container;
const Grid = layoutStyles.grid;
const LeftPanel = layoutStyles.leftPanel;
const Main = layoutStyles.main;
const Companion = layoutStyles.companion;

// Helper function to find space from URL path
const findSpaceByPath = (path: string, spacesList: Space[]): Space | null => {
  if (path === '/') return null;

  const pathSegments = path.split('/').filter(Boolean);

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

export function Home() {
  const route = useRoute();
  const footerRef = useRef<HTMLDivElement>(null);
  const createPostButtonRef = useRef<HTMLDivElement>(null);

  // Calculate max height for spaces container
  const spacesMaxHeight = useContainerHeight(
    [footerRef, createPostButtonRef],
    { gaps: 3, padding: 2, maxHeight: 1000 }
  );

  // Set initial space from URL on first render (before child components mount)
  // This prevents unnecessary fetches for spaceId=0
  if (currentSpaceSignal.value === null && spaces.value.length > 0) {
    const spaceFromUrl = findSpaceByPath(route.path, spaces.value);
    if (spaceFromUrl) {
      currentSpaceSignal.value = spaceFromUrl;
    }
  }

  // Persisted state is now loaded in App.tsx, so we don't need to load it here anymore

  // Sync URL with currentSpace state
  useEffect(() => {
    const spaceFromUrl = findSpaceByPath(route.path, spaces.value);

    // Update state to match URL
    if (spaceFromUrl?.id !== currentSpaceSignal.value?.id) {
      selectSpace(spaceFromUrl);
    }
  }, [route.path]);

  // Use the signal value, not URL-derived value
  const currentSpace = currentSpaceSignal.value;

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
              <SpacesContainer currentSpace={currentSpace} maxHeight={spacesMaxHeight} />
              <div ref={createPostButtonRef}>
                <CreatePostButton currentSpace={currentSpace} />
              </div>
              <div ref={footerRef}>
                <FooterLinks />
              </div>
            </div>
          </LeftPanel>
          <Main>
            <Timeline
              spaceId={currentSpace?.id || null}
              recursive={currentSpace ? isRecursiveMode(currentSpace.id) : false}
            />
          </Main>

          <Companion>
            <div style={{
              position: 'sticky',
              top: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <CompanionPanel space={currentSpace} />
              <ActivityTracker currentSpace={currentSpace} />
            </div>
          </Companion>
        </Grid>
      </Container>

      {imageViewerState.value.isOpen && (
        <ImageViewer
          images={imageViewerState.value.images}
          startIndex={imageViewerState.value.startIndex}
          onClose={closeImageViewer}
        />
      )}
    </Layout>
  );
}

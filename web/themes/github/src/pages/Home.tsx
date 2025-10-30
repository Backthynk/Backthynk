import { useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { spaces, loadExpandedSpaces, expandParentSpaces } from '@core/state';
import { fetchSpaces as fetchSpacesApi } from '@core/api';
import { generateSlug } from '@core/utils';
import { Layout } from '../components/Layout';
import { SpacesContainer } from '../components/SpacesContainer';
import { FooterLinks } from '../components/spaces-container';
import { ActivityTracker } from '../components/activity';
import { Timeline } from '../components/Timeline';
import { layoutStyles } from '../styles/layout';
import type { Space } from '@core/api';

const Container = layoutStyles.container;
const Grid = layoutStyles.grid;
const LeftPanel = layoutStyles.leftPanel;
const Main = layoutStyles.main;
const Companion = layoutStyles.companion;

export function Home() {
  const route = useRoute();

  // Find space from URL path
  const findSpaceByPath = (path: string): Space | null => {
    if (path === '/') return null;

    const pathSegments = path.split('/').filter(Boolean);
    const spacesList = spaces.value;

    let currentSpace: Space | null = null;
    let currentParentId: number | null = null;

    for (const segment of pathSegments) {
      const found = spacesList.find(s =>
        generateSlug(s.name) === segment &&
        s.parent_id === currentParentId
      );

      if (!found) return null;

      currentSpace = found;
      currentParentId = found.id;
    }

    return currentSpace;
  };

  const currentSpace = findSpaceByPath(route.path);

  useEffect(() => {
    // Load expanded spaces from localStorage
    loadExpandedSpaces();

    // Only fetch spaces if not already hydrated from SSR
    if (spaces.value.length === 0) {
      fetchSpacesApi().then((fetchedSpaces) => {
        spaces.value = fetchedSpaces;
      });
    }
  }, []);

  // Auto-expand and scroll to selected space
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
            <Timeline spaceId={currentSpace?.id || null} recursive={false} />
          </Main>

          <Companion>
            {/* Right companion panel - will be added later */}
          </Companion>
        </Grid>
      </Container>
    </Layout>
  );
}

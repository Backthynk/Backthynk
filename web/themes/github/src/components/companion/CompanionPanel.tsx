import type { Space } from '@core/api';
import { companionStyles } from '../../styles/companion';
import { SearchSection } from './SearchSection';
import { SpaceHeaderCard } from './SpaceHeaderCard';
import { StatsCard } from './StatsCard';

const Container = companionStyles.container;

interface CompanionPanelProps {
  space: Space | null;
}

export function CompanionPanel({ space }: CompanionPanelProps) {
  return (
    <Container>
      <SearchSection />
      <SpaceHeaderCard space={space} />
      <StatsCard space={space} />
    </Container>
  );
}

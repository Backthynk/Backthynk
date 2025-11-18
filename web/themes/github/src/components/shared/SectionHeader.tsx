import { postStyles } from '../../styles/post';

const Header = postStyles.attachmentsHeader;
const Title = postStyles.attachmentsTitle;
const NavControls = postStyles.navControls;
const NavButton = postStyles.navButton;
const NavCounter = postStyles.navCounter;

interface SectionHeaderProps {
  title: string;
  currentCount: number;
  totalCount: number;
  onNavigate: (direction: number) => void;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
}

export function SectionHeader({ title, currentCount, totalCount, onNavigate, canNavigateBack, canNavigateForward }: SectionHeaderProps) {
  return (
    <Header>
      <Title>{title}</Title>
      <NavControls>
        <NavButton disabled={!canNavigateBack} onClick={() => onNavigate(-1)}>
          <i class="fas fa-chevron-left" />
        </NavButton>
        <NavCounter>
          {currentCount} / {totalCount}
        </NavCounter>
        <NavButton disabled={!canNavigateForward} onClick={() => onNavigate(1)}>
          <i class="fas fa-chevron-right" />
        </NavButton>
      </NavControls>
    </Header>
  );
}

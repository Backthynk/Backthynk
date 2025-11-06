import { theme, toggleTheme } from '@core/state';
import { app } from '@core/config';
import { spacesContainerStyles } from '../../styles/spaces-container';

const FooterContainer = spacesContainerStyles.footerLinks;
const ActionsCard = spacesContainerStyles.footerActionsCard;
const ActionButton = spacesContainerStyles.footerActionButton;
const InfoText = spacesContainerStyles.footerInfoText;

export function FooterLinks() {
  const currentYear = new Date().getFullYear();
  const currentTheme = theme.value;

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const handleSettingsClick = () => {
    // TODO: Implement settings navigation
    console.log('Settings clicked');
  };

  return (
    <FooterContainer>
      <ActionsCard>
        <ActionButton onClick={handleThemeToggle} title="Toggle theme">
          {currentTheme === 'light' ? (
            <i class="fas fa-moon" />
          ) : (
            <i class="fas fa-sun" />
          )}
        </ActionButton>
        <ActionButton onClick={handleSettingsClick} title="Settings">
          <i class="fas fa-sliders-h" />
        </ActionButton>
      </ActionsCard>
      <InfoText>
        <div>Powered by Backthynk</div>
        <div>v{app.version} © {currentYear}</div>
      </InfoText>
    </FooterContainer>
  );
}

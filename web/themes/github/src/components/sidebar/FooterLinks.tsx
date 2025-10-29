import { theme, toggleTheme } from '@core/state';
import { sidebarStyles } from '../../styles/sidebar';

const FooterContainer = sidebarStyles.footerLinks;
const ActionsCard = sidebarStyles.footerActionsCard;
const ActionButton = sidebarStyles.footerActionButton;
const InfoText = sidebarStyles.footerInfoText;

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
        <div>v0.2.0 © {currentYear}</div>
      </InfoText>
    </FooterContainer>
  );
}

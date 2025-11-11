/* disabled for now : 11.11.2025
import { styled } from 'goober';
import { useState, useRef, useEffect } from 'preact/hooks';
import { useTooltip } from '@core/components/Tooltip';
import type { ProfileData } from './profileData';

const Container = styled('div')`
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 1rem;
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`;

const AvatarWrapper = styled('div')`
  position: relative;
`;

const Avatar = styled('img')`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--border-primary);
  cursor: pointer;
`;

const AvatarTooltip = styled('div')<{ show: boolean }>`
  position: absolute;
  left: 50%;
  top: calc(100% + 0.5rem);
  transform: translateX(-50%);
  z-index: 1000;
  opacity: ${props => props.show ? 1 : 0};
  pointer-events: none;
  transition: opacity 0.2s ease;

  img {
    width: 200px;
    height: 200px;
    border-radius: 12px;
    border: 1px solid var(--border-primary);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
`;

const Info = styled('div')`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

const Name = styled('h1')`
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Username = styled('div')`
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Bio = styled('div')`
  font-size: 0.8125rem;
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: 0.75rem;
`;

const Divider = styled('div')`
  height: 1px;
  background: var(--border-primary);
  margin-bottom: 0.75rem;
`;

const Meta = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
`;

const MetaItem = styled('div')`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
  cursor: default;

  i {
    font-size: 0.75rem;
    opacity: 0.7;
    width: 12px;
    text-align: center;
    flex-shrink: 0;
  }

  span, a {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  a {
    color: var(--text-link);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

interface ProfileHeaderProps {
  profile: ProfileData;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const [showAvatarTooltip, setShowAvatarTooltip] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const { show: showTooltip, hide: hideTooltip, TooltipPortal } = useTooltip();

  const handleAvatarMouseEnter = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setShowAvatarTooltip(true);
    }, 300);
  };

  const handleAvatarMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowAvatarTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Helper to check if text is truncated and show tooltip
  const handleTextHover = (e: MouseEvent, fullText: string) => {
    const target = e.currentTarget as HTMLElement;
    // Find the actual text element (span or a) inside the MetaItem
    const textElement = target.querySelector('span, a') as HTMLElement;
    if (textElement && textElement.scrollWidth > textElement.clientWidth) {
      showTooltip(target, fullText);
    }
  };

  // Platform configurations
  const platforms = [
    { key: 'github', username: profile.githubUsername, icon: 'fab fa-github', url: (u: string) => `https://github.com/${u}` },
    { key: 'x', username: profile.xUsername, icon: 'fab fa-x-twitter', url: (u: string) => `https://x.com/${u}` },
    { key: 'gitlab', username: profile.gitlabUsername, icon: 'fab fa-gitlab', url: (u: string) => `https://gitlab.com/${u}` },
    { key: 'bitbucket', username: profile.bitbucketUsername, icon: 'fab fa-bitbucket', url: (u: string) => `https://bitbucket.org/${u}` },
    { key: 'discord', username: profile.discordUsername, icon: 'fab fa-discord', url: (u: string) => `https://discord.com/users/${u}` },
    { key: 'devto', username: profile.devtoUsername, icon: 'fab fa-dev', url: (u: string) => `https://dev.to/${u}` },
    { key: 'hashnode', username: profile.hashnodeUsername, icon: 'fas fa-hashtag', url: (u: string) => `https://hashnode.com/@${u}` },
    { key: 'medium', username: profile.mediumUsername, icon: 'fab fa-medium', url: (u: string) => `https://medium.com/@${u}` },
    { key: 'substack', username: profile.substackUsername, icon: 'fas fa-newspaper', url: (u: string) => `https://${u}.substack.com` },
  ];

  // Collect all available meta items
  const metaItems = [];

  if (profile.company) {
    metaItems.push(
      <MetaItem
        key="company"
        onMouseEnter={(e: MouseEvent) => handleTextHover(e, profile.company!)}
        onMouseLeave={hideTooltip}
      >
        <i class="fas fa-building" />
        <span>{profile.company}</span>
      </MetaItem>
    );
  }

  if (profile.location) {
    metaItems.push(
      <MetaItem
        key="location"
        onMouseEnter={(e: MouseEvent) => handleTextHover(e, profile.location!)}
        onMouseLeave={hideTooltip}
      >
        <i class="fas fa-map-marker-alt" />
        <span>{profile.location}</span>
      </MetaItem>
    );
  }

  if (profile.website) {
    const displayUrl = profile.website.replace(/^https?:\/\//, '');
    metaItems.push(
      <MetaItem
        key="website"
        onMouseEnter={(e: MouseEvent) => handleTextHover(e, profile.website!)}
        onMouseLeave={hideTooltip}
      >
        <i class="fas fa-link" />
        <a href={profile.website} target="_blank" rel="noopener noreferrer">
          {displayUrl}
        </a>
      </MetaItem>
    );
  }

  // Add all platform usernames
  platforms.forEach(({ key, username, icon, url }) => {
    if (username) {
      metaItems.push(
        <MetaItem
          key={key}
          onMouseEnter={(e: MouseEvent) => handleTextHover(e, username)}
          onMouseLeave={hideTooltip}
        >
          <i class={icon} />
          <a href={url(username)} target="_blank" rel="noopener noreferrer">
            {username}
          </a>
        </MetaItem>
      );
    }
  });

  return (
    <Container>
      <Header>
        <AvatarWrapper
          onMouseEnter={handleAvatarMouseEnter}
          onMouseLeave={handleAvatarMouseLeave}
        >
          <Avatar src={profile.avatarUrl} alt={profile.name} />
          <AvatarTooltip show={showAvatarTooltip}>
            <img src={profile.avatarUrl} alt={profile.name} />
          </AvatarTooltip>
        </AvatarWrapper>
        <Info>
          <Name>{profile.name}</Name>
          <Username>{profile.username}</Username>
        </Info>
      </Header>

      {profile.bio && <Bio>{profile.bio}</Bio>}

      {metaItems.length > 0 && (
        <>
          <Divider />
          <Meta>{metaItems}</Meta>
        </>
      )}

      {TooltipPortal}
    </Container>
  );
}

*/
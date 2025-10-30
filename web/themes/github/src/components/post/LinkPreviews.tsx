import { useState } from 'preact/hooks';
import type { LinkPreview } from '@core/api';
import { postStyles } from '../../styles/post';

const Section = postStyles.attachmentsSection;
const Header = postStyles.attachmentsHeader;
const Title = postStyles.attachmentsTitle;
const NavControls = postStyles.navControls;
const NavButton = postStyles.navButton;
const NavCounter = postStyles.navCounter;
const Container = postStyles.attachmentsContainer;
const List = postStyles.attachmentsList;
const Card = postStyles.linkPreviewCard;
const Image = postStyles.linkPreviewImage;
const CardContent = postStyles.linkPreviewContent;
const CardTitle = postStyles.linkPreviewTitle;
const CardDescription = postStyles.linkPreviewDescription;
const CardMeta = postStyles.linkPreviewMeta;

interface LinkPreviewsProps {
  previews: LinkPreview[];
  postId: number;
  standalone?: boolean; // When true, show without header/navigation (for preview-only posts)
}

export function LinkPreviews({ previews, postId, standalone = false }: LinkPreviewsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!previews || previews.length === 0) return null;

  const navigatePreview = (direction: number) => {
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = previews.length - 1;
    if (newIndex >= previews.length) newIndex = 0;
    setCurrentIndex(newIndex);
  };

  // For standalone mode (preview-only posts), show single preview without header
  if (standalone && previews.length === 1) {
    const preview = previews[0];
    return (
      <Container style={{ marginTop: '0.75rem' }}>
        <Card href={preview.url} target="_blank" rel="noopener noreferrer">
          {preview.image_url && (
            <Image>
              <img
                src={preview.image_url}
                alt=""
                onError={(e) => {
                  (e.target as HTMLElement).parentElement!.style.display = 'none';
                }}
              />
            </Image>
          )}
          <CardContent>
            <CardTitle>{preview.title || preview.url}</CardTitle>
            {preview.description && <CardDescription>{preview.description}</CardDescription>}
            <CardMeta>
              <i class="fas fa-external-link-alt" />
              <span>{preview.site_name ? preview.site_name : new URL(preview.url).hostname}</span>
            </CardMeta>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Section>
      <Header>
        <Title>Link Previews</Title>
        {previews.length > 1 && (
          <NavControls>
            <NavButton disabled={previews.length <= 1} onClick={() => navigatePreview(-1)}>
              <i class="fas fa-chevron-left" />
            </NavButton>
            <NavCounter>
              {currentIndex + 1} / {previews.length}
            </NavCounter>
            <NavButton disabled={previews.length <= 1} onClick={() => navigatePreview(1)}>
              <i class="fas fa-chevron-right" />
            </NavButton>
          </NavControls>
        )}
      </Header>

      <Container>
        <List style={{ transform: `translateX(calc(-${currentIndex} * (100% + 0.75rem)))` }}>
          {previews.map((preview, idx) => (
            <Card key={idx} href={preview.url} target="_blank" rel="noopener noreferrer">
              {preview.image_url && (
                <Image>
                  <img
                    src={preview.image_url}
                    alt=""
                    onError={(e) => {
                      (e.target as HTMLElement).parentElement!.style.display = 'none';
                    }}
                  />
                </Image>
              )}
              <CardContent>
                <CardTitle>{preview.title || preview.url}</CardTitle>
                {preview.description && <CardDescription>{preview.description}</CardDescription>}
                <CardMeta>
                  <i class="fas fa-external-link-alt" />
                  <span>{preview.site_name ? preview.site_name : new URL(preview.url).hostname}</span>
                </CardMeta>
              </CardContent>
            </Card>
          ))}
        </List>
      </Container>
    </Section>
  );
}

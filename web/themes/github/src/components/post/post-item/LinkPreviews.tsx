import { useState } from 'preact/hooks';
import type { LinkPreview } from '@core/api';
import { LazyImage } from '@core/components';
import { postStyles } from '../../../styles/post';
import { SectionHeader } from './SectionHeader';

const Section = postStyles.attachmentsSection;
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
              <LazyImage
                src={preview.image_url}
                alt=""
                showError={false}
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
    <Section style={previews.length === 1 ? { borderTop: 'none', paddingTop: '0', marginTop: '0.75rem' } : {}}>
      {previews.length > 1 && (
        <SectionHeader
          title="Link Previews"
          currentCount={currentIndex + 1}
          totalCount={previews.length}
          onNavigate={navigatePreview}
          canNavigateBack={currentIndex > 0}
          canNavigateForward={currentIndex < previews.length - 1}
        />
      )}

      <Container>
        <List style={{ transform: `translateX(calc(-${currentIndex} * (100% + 0.75rem)))` }}>
          {previews.map((preview, idx) => (
            <Card key={idx} href={preview.url} target="_blank" rel="noopener noreferrer">
              {preview.image_url && (
                <Image>
                  <LazyImage
                    src={preview.image_url}
                    alt=""
                    showError={false}
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

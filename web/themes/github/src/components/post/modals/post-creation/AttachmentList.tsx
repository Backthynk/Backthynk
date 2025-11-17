import { Ref } from 'preact';
import { useState } from 'preact/hooks';
import { postCreationModalStyles } from '../../../../styles/post-creation-modal';

const Section = postCreationModalStyles.attachmentsSection;
const Header = postCreationModalStyles.attachmentsHeader;
const Title = postCreationModalStyles.attachmentsTitle;
const NavControls = postCreationModalStyles.navControls;
const NavButton = postCreationModalStyles.navButton;
const NavCounter = postCreationModalStyles.navCounter;
const AttachmentsGrid = postCreationModalStyles.attachmentsGrid;
const AttachmentItem = postCreationModalStyles.attachmentItem;
const AttachmentPreview = postCreationModalStyles.attachmentPreview;
const RemoveButton = postCreationModalStyles.removeButton;

interface AttachmentListProps {
  attachmentGridRef: Ref<HTMLDivElement>;
  attachments: File[];
  previewUrls: Map<File, string>;
  onRemove: (index: number) => void;
}

const ITEMS_PER_PAGE = 4;
const GRID_HEIGHT = 300; // Height in pixels

export function AttachmentList({
  attachmentGridRef,
  attachments,
  previewUrls,
  onRemove,
}: AttachmentListProps) {
  const [currentPage, setCurrentPage] = useState(0);

  if (attachments.length === 0) return null;

  const totalPages = Math.ceil(attachments.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, attachments.length);
  const visibleAttachments = attachments.slice(startIndex, endIndex);
  const visibleCount = visibleAttachments.length;

  const navigatePage = (direction: number) => {
    const newPage = currentPage + direction;
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Section>
      {attachments.length > ITEMS_PER_PAGE && (
        <Header>
          <Title>Attachments</Title>
          <NavControls>
            <NavButton disabled={currentPage === 0} onClick={() => navigatePage(-1)}>
              <i class="fas fa-chevron-left" />
            </NavButton>
            <NavCounter>
              {endIndex} / {attachments.length}
            </NavCounter>
            <NavButton disabled={currentPage === totalPages - 1} onClick={() => navigatePage(1)}>
              <i class="fas fa-chevron-right" />
            </NavButton>
          </NavControls>
        </Header>
      )}

      <AttachmentsGrid
        ref={attachmentGridRef}
        style={{ height: `${GRID_HEIGHT}px` }}
        data-count={currentPage === 0 ? visibleCount : 4}
      >
        {visibleAttachments.map((file, visibleIndex) => {
          const index = startIndex + visibleIndex;
          const isImage = file.type.startsWith('image/');
          const previewUrl = previewUrls.get(file);

          return (
            <AttachmentItem key={index} data-is-image={isImage}>
              <AttachmentPreview>
                {isImage && previewUrl ? (
                  <img src={previewUrl} alt={file.name} />
                ) : (
                  <div class="file-icon">
                    <i class="fas fa-file" />
                    <span>{file.name.split('.').pop()?.toUpperCase()}</span>
                  </div>
                )}
              </AttachmentPreview>
              <RemoveButton onClick={() => onRemove(index)}>
                <i class="fas fa-times" />
              </RemoveButton>
              {!isImage && (
                <div class="file-info">
                  <span class="filename">{file.name}</span>
                  <span class="filesize">{formatFileSize(file.size)}</span>
                </div>
              )}
            </AttachmentItem>
          );
        })}
      </AttachmentsGrid>
    </Section>
  );
}

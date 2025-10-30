import { useState, useRef, useEffect } from 'preact/hooks';
import type { PostFile } from '@core/api';
import { formatFileSize } from '@core/utils';
import { getFileIcon, isImageFile } from '@core/utils/files';
import { ImageViewer } from '@core/components/ImageViewer';
import { postStyles } from '../../styles/post';

const Section = postStyles.attachmentsSection;
const Header = postStyles.attachmentsHeader;
const Title = postStyles.attachmentsTitle;
const NavControls = postStyles.navControls;
const NavButton = postStyles.navButton;
const NavCounter = postStyles.navCounter;
const Container = postStyles.attachmentsContainer;
const List = postStyles.attachmentsList;
const Attachment = postStyles.attachment;
const FilePreview = postStyles.filePreview;
const FileOverlay = postStyles.fileOverlay;

interface FileAttachmentsProps {
  files: PostFile[];
}

export function FileAttachments({ files }: FileAttachmentsProps) {
  // Safety check: ensure files is an array BEFORE any hooks
  if (!files || !files.length) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const images = files.filter((f) => isImageFile(f.file_type));
  const otherFiles = files.filter((f) => !isImageFile(f.file_type));
  const allFiles = [...images, ...otherFiles];

  // Calculate visible items and update navigation
  useEffect(() => {
    if (!containerRef.current || !files || files.length === 0) return;

    const updateNavigation = () => {
      const container = containerRef.current;
      if (!container || !container.children) return;

      const children = Array.from(container.children) as HTMLElement[];
      if (!children || children.length === 0) return;

      const containerWidth = container.offsetWidth;
      let rightmostVisibleIndex = 0;
      let accumulatedWidth = 0;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childWidth = child.offsetWidth;
        const gap = 12; // 0.75rem gap

        if (i === 0 || accumulatedWidth + childWidth <= containerWidth) {
          rightmostVisibleIndex = i;
          accumulatedWidth += childWidth + (i < children.length - 1 ? gap : 0);
        } else {
          if (accumulatedWidth < containerWidth) {
            rightmostVisibleIndex = i;
          }
          break;
        }
      }

      setVisibleIndex(rightmostVisibleIndex + 1);
    };

    updateNavigation();
    window.addEventListener('resize', updateNavigation);
    return () => window.removeEventListener('resize', updateNavigation);
  }, [files]);

  const scrollAttachments = (direction: number) => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    if (!container.children) return;

    const children = Array.from(container.children) as HTMLElement[];
    if (!children || children.length === 0) return;

    let targetIndex = currentIndex + direction;
    targetIndex = Math.max(0, Math.min(targetIndex, children.length - 1));

    const targetChild = children[targetIndex];
    if (!targetChild) return;

    const translateX = -targetChild.offsetLeft;
    container.style.transform = `translateX(${translateX}px)`;
    setCurrentIndex(targetIndex);

    // Update visible count
    const containerParent = container.parentElement;
    if (!containerParent) return;
    const containerWidth = containerParent.offsetWidth;
    const actualVisibleRight = -translateX + containerWidth;

    let actualRightmostIndex = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childRight = child.offsetLeft + child.offsetWidth;
      if (childRight <= actualVisibleRight + 1) {
        actualRightmostIndex = i;
      }
    }
    setVisibleIndex(actualRightmostIndex + 1);
  };

  const openImageGallery = (fileIndex: number) => {
    const imageIndex = images.findIndex((img) => img.id === allFiles[fileIndex].id);
    if (imageIndex >= 0) {
      setImageViewerIndex(imageIndex);
      setShowImageViewer(true);
    }
  };

  const imageData = images.map((img) => ({
    url: `/uploads/${img.file_path}`,
    filename: img.filename,
  }));

  return (
    <Section>
      <Header>
        <Title>Attachments</Title>
        <NavControls>
          <NavButton disabled={currentIndex === 0} onClick={() => scrollAttachments(-1)}>
            <i class="fas fa-chevron-left" />
          </NavButton>
          <NavCounter>
            {visibleIndex} / {allFiles.length}
          </NavCounter>
          <NavButton disabled={visibleIndex >= allFiles.length} onClick={() => scrollAttachments(1)}>
            <i class="fas fa-chevron-right" />
          </NavButton>
        </NavControls>
      </Header>

      <Container>
        <List ref={containerRef}>
          {allFiles.map((file, idx) => {
            const isImage = isImageFile(file.file_type);
            const fileExtension = file.filename.split('.').pop()?.toLowerCase() || 'FILE';
            const fileSizeText = formatFileSize(file.file_size);
            const tooltipText = `${file.filename} • ${fileSizeText}`;

            if (isImage) {
              return (
                <Attachment
                  key={file.id}
                  onClick={() => openImageGallery(idx)}
                  title={tooltipText}
                >
                  <img src={`/uploads/${file.file_path}`} alt={file.filename} />
                  <FileOverlay>
                    <p>{file.filename}</p>
                    <p class="size">{fileSizeText}</p>
                  </FileOverlay>
                </Attachment>
              );
            } else {
              return (
                <Attachment
                  key={file.id}
                  onClick={() => window.open(`/uploads/${file.file_path}`, '_blank')}
                  title={tooltipText}
                >
                  <FilePreview>
                    <i class={`fas ${getFileIcon(fileExtension)}`} />
                    <span>{fileExtension.toUpperCase()}</span>
                  </FilePreview>
                  <FileOverlay>
                    <p>{file.filename}</p>
                    <p class="size">{fileSizeText}</p>
                  </FileOverlay>
                </Attachment>
              );
            }
          })}
        </List>
      </Container>

      {showImageViewer && (
        <ImageViewer images={imageData} startIndex={imageViewerIndex} onClose={() => setShowImageViewer(false)} />
      )}
    </Section>
  );
}

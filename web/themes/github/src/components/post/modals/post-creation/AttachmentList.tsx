import { Ref } from 'preact';
import { postCreationModalStyles } from '../../../../styles/post-creation-modal';

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

export function AttachmentList({
  attachmentGridRef,
  attachments,
  previewUrls,
  onRemove,
}: AttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <AttachmentsGrid ref={attachmentGridRef}>
      {attachments.map((file, index) => {
        const isImage = file.type.startsWith('image/');
        const previewUrl = previewUrls.get(file);

        return (
          <AttachmentItem key={index}>
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
              </div>
            )}
          </AttachmentItem>
        );
      })}
    </AttachmentsGrid>
  );
}

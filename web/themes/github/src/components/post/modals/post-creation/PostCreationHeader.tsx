import { SpaceSelector } from '../../../spaces-container/SpaceSelector';
import { postCreationModalStyles } from '../../../../styles/post-creation-modal';

const Header = postCreationModalStyles.header;
const SpaceSelectorWrapper = postCreationModalStyles.spaceSelectorWrapper;
const ToolbarButton = postCreationModalStyles.toolbarButton;

interface PostCreationHeaderProps {
  selectedSpaceId: number | null;
  onSpaceChange: (value: number | null) => void;
  error: string;
  showPreview: boolean;
  onTogglePreview: () => void;
}

export function PostCreationHeader({
  selectedSpaceId,
  onSpaceChange,
  error,
  showPreview,
  onTogglePreview,
}: PostCreationHeaderProps) {
  return (
    <Header>
      <SpaceSelectorWrapper>
        <label>Publish to:</label>
        <SpaceSelector
          value={selectedSpaceId}
          onChange={onSpaceChange}
          placeholder={error && error.includes('space') ? error : "Select a space..."}
          error={!!(error && error.includes('space'))}
          showAllDepths={true}
        />
      </SpaceSelectorWrapper>
      <ToolbarButton
        onClick={onTogglePreview}
        title={showPreview ? "Hide preview" : "Show preview"}
        className={showPreview ? 'active' : ''}
      >
        <i class={showPreview ? "fas fa-edit" : "fas fa-eye"} />
      </ToolbarButton>
    </Header>
  );
}

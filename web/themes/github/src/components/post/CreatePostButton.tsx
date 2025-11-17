import { useState } from 'preact/hooks';
import { spacesContainerStyles } from '../../styles/spaces-container';
import { PostCreationModal } from './modals/post-creation';
import type { Space } from '@core/api';

const ButtonContainer = spacesContainerStyles.createPostButtonContainer;
const Button = spacesContainerStyles.createPostButton;

interface CreatePostButtonProps {
  currentSpace: Space | null;
}

export function CreatePostButton({ currentSpace }: CreatePostButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <ButtonContainer>
        <Button onClick={() => setIsModalOpen(true)}>
          <i class="fas fa-plus" />
          <span>Create Post</span>
        </Button>
      </ButtonContainer>

      <PostCreationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentSpace={currentSpace}
      />
    </>
  );
}

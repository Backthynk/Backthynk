import { type Space } from '@core/api';
import { addSpaceAction } from '@core/actions/spaceActions';
import { SpaceFormModal } from './SpaceFormModal';

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentSpace: Space | null;
}

export function CreateSpaceModal({ isOpen, onClose, onSuccess, currentSpace }: CreateSpaceModalProps) {
  const handleSubmit = async (data: { name: string; description: string; parent_id: number | null }) => {
    try {
      await addSpaceAction({
        payload: {
          name: data.name,
          description: data.description,
          parent_id: data.parent_id,
        },
        onSuccess: () => {
          if (onSuccess) {
            onSuccess();
          }
        },
      });
    } catch (error) {
      console.error('Add space action failed:', error);
      throw error;
    }
  };

  return (
    <SpaceFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      mode="create"
      currentSpace={currentSpace}
    />
  );
}

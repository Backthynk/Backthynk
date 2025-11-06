import { type Space } from '@core/api';
import { updateSpaceAction } from '@core/actions/spaceActions';
import { SpaceFormModal } from './SpaceFormModal';

interface UpdateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | null;
}

export function UpdateSpaceModal({ isOpen, onClose, space }: UpdateSpaceModalProps) {
  const handleSubmit = async (data: { name: string; description: string; parent_id: number | null }) => {
    if (!space) return;

    try {
      await updateSpaceAction({
        spaceId: space.id,
        payload: {
          name: data.name,
          description: data.description,
          parent_id: data.parent_id,
        },
      });
    } catch (error) {
      console.error('Update space action failed:', error);
      throw error;
    }
  };

  return (
    <SpaceFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      mode="update"
      initialData={
        space
          ? {
              name: space.name,
              description: space.description || '',
              parent_id: space.parent_id,
              space_id: space.id,
            }
          : undefined
      }
    />
  );
}

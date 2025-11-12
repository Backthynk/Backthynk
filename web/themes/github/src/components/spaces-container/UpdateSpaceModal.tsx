import { useMemo } from 'preact/hooks';
import { type Space } from '@core/api';
import { updateSpaceAction } from '@core/actions/spaceActions';
import { getSpaceById } from '@core/state';
import { SpaceFormModal } from './SpaceFormModal';

interface UpdateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | null;
  router?: any;
}

export function UpdateSpaceModal({ isOpen, onClose, space, router }: UpdateSpaceModalProps) {
  // Get the latest space data from the signal to ensure reactivity
  // This fixes the issue where description updates don't show immediately
  const currentSpace = space ? getSpaceById(space.id) : null;

  const handleSubmit = async (data: { name: string; description: string; parent_id: number | null }) => {
    if (!currentSpace) return;

    try {
      await updateSpaceAction({
        spaceId: currentSpace.id,
        payload: {
          name: data.name,
          description: data.description,
          parent_id: data.parent_id,
        },
        router,
      });
    } catch (error) {
      console.error('Update space action failed:', error);
      throw error;
    }
  };

  // Use useMemo to only recreate initialData when the space actually changes
  const initialData = useMemo(
    () =>
      currentSpace
        ? {
            name: currentSpace.name,
            description: currentSpace.description || '',
            parent_id: currentSpace.parent_id,
            space_id: currentSpace.id,
          }
        : undefined,
    [currentSpace?.id, currentSpace?.name, currentSpace?.description, currentSpace?.parent_id]
  );

  return (
    <SpaceFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      mode="update"
      initialData={initialData}
    />
  );
}

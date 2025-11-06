import { useState, useEffect } from 'preact/hooks';
import { Modal, formStyles } from '../modal';
import { SpaceSelector } from '../SpaceSelector';
import { type Space } from '@core/api';
import { spaces } from '@core/state';
import { generateSlug } from '@core/utils';
import { showError } from '@core/components';
import { space as spaceConfig } from '@core/config';
import { updateSpaceAction } from '@core/actions/spaceActions';

const FormGroup = formStyles.formGroup;
const Label = formStyles.label;
const Input = formStyles.input;
const Textarea = formStyles.textarea;
const Error = formStyles.error;
const Hint = formStyles.hint;
const Button = formStyles.button;

interface UpdateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  space: Space | null;
}

interface ValidationErrors {
  name?: string;
  parent?: string;
}

export function UpdateSpaceModal({ isOpen, onClose, onSuccess, space }: UpdateSpaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardWarning, setShowDiscardWarning] = useState(false);

  // Initialize form when modal opens or space changes
  useEffect(() => {
    if (isOpen && space) {
      setName(space.name);
      setDescription(space.description || '');
      setParentId(space.parent_id);
    } else {
      // Reset form when modal closes
      setName('');
      setDescription('');
      setParentId(null);
      setErrors({});
      setIsSubmitting(false);
      setShowDiscardWarning(false);
    }
  }, [isOpen, space]);

  // Check if form has been modified
  const isFormDirty = () => {
    if (!space) return false;
    return (
      name.trim() !== space.name ||
      description.trim() !== (space.description || '') ||
      parentId !== space.parent_id
    );
  };

  // Handle close with discard warning
  const handleClose = () => {
    if (isFormDirty() && !showDiscardWarning) {
      setShowDiscardWarning(true);
    } else {
      onClose();
    }
  };

  // Validate space name format
  const validateName = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Name is required';
    }

    if (value.length > spaceConfig.name.maxLength) {
      return `Name must not exceed ${spaceConfig.name.maxLength} characters`;
    }

    if (!spaceConfig.name.pattern.test(value)) {
      return 'Name must start with a letter or number, and can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, and periods';
    }

    return undefined;
  };

  // Check if slug/name already exists at the same level (excluding current space)
  const checkDuplicateSlug = (value: string, parent: number | null): string | undefined => {
    if (!space) return undefined;

    const slug = generateSlug(value);
    const allSpaces = spaces.value;

    // Find spaces with the same parent, excluding the current space
    const siblingsSpaces = allSpaces.filter((s) => s.parent_id === parent && s.id !== space.id);

    // Check if any sibling has the same slug
    const duplicate = siblingsSpaces.find((s) => generateSlug(s.name) === slug);

    if (duplicate) {
      return `A space with this name already exists at this level (conflicts with "${duplicate.name}")`;
    }

    return undefined;
  };

  // Validate parent selection (check depth and prevent circular reference)
  const validateParent = (parent: number | null): string | undefined => {
    if (!space) return undefined;
    if (parent === null) return undefined;

    // Prevent setting parent to itself
    if (parent === space.id) {
      return 'Cannot set a space as its own parent';
    }

    // Prevent circular reference - check if parent is a descendant of current space
    const isDescendant = (spaceId: number, potentialAncestorId: number): boolean => {
      const s = spaces.value.find((sp) => sp.id === spaceId);
      if (!s || s.parent_id === null) return false;
      if (s.parent_id === potentialAncestorId) return true;
      return isDescendant(s.parent_id, potentialAncestorId);
    };

    if (isDescendant(parent, space.id)) {
      return 'Cannot set a descendant space as parent (would create circular reference)';
    }

    const parentSpace = spaces.value.find((s) => s.id === parent);
    if (!parentSpace) return 'Invalid parent space';

    // Check depth constraint
    if (parentSpace.parent_id !== null) {
      const grandparent = spaces.value.find((s) => s.id === parentSpace.parent_id);
      if (grandparent && grandparent.parent_id !== null) {
        return 'Cannot move space: maximum depth (2 levels) would be exceeded';
      }
    }

    return undefined;
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    const nameError = validateName(name);
    if (nameError) {
      newErrors.name = nameError;
    } else {
      const duplicateError = checkDuplicateSlug(name, parentId);
      if (duplicateError) {
        newErrors.name = duplicateError;
      }
    }

    const parentError = validateParent(parentId);
    if (parentError) {
      newErrors.parent = parentError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Real-time validation on name change
  useEffect(() => {
    if (name) {
      const nameError = validateName(name);
      const duplicateError = nameError ? undefined : checkDuplicateSlug(name, parentId);
      setErrors((prev) => ({
        ...prev,
        name: nameError || duplicateError,
      }));
    } else {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  }, [name, parentId]);

  // Real-time validation on parent change
  useEffect(() => {
    const parentError = validateParent(parentId);
    const duplicateError = name ? checkDuplicateSlug(name, parentId) : undefined;

    setErrors((prev) => ({
      ...prev,
      parent: parentError,
      name: duplicateError || (prev.name && !prev.name.includes('conflicts with') ? prev.name : undefined),
    }));
  }, [parentId]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!space || !validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await updateSpaceAction({
        spaceId: space.id,
        payload: {
          name: name.trim(),
          description: description.trim(),
          parent_id: parentId,
        },
        onSuccess: () => {
          onSuccess();
          onClose();
        },
      });
    } catch (error) {
      // Error handling is done in the action
      console.error('Update space action failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = !errors.name && !errors.parent && name.trim().length > 0;

  // Discard warning modal footer
  const discardWarningFooter = (
    <>
      <Button type="button" className="secondary" onClick={() => setShowDiscardWarning(false)}>
        Continue Editing
      </Button>
      <Button type="button" className="danger" onClick={onClose}>
        Discard Changes
      </Button>
    </>
  );

  // Main form footer
  const footer = (
    <>
      <Button type="button" className="secondary" onClick={handleClose} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button
        type="submit"
        className="success"
        onClick={handleSubmit}
        disabled={!isFormValid || isSubmitting}
      >
        {isSubmitting ? 'Updating...' : 'Update space'}
      </Button>
    </>
  );

  // Show discard warning modal if form is dirty
  if (showDiscardWarning) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => setShowDiscardWarning(false)}
        onOverlayClick={() => setShowDiscardWarning(false)}
        title="Discard changes?"
        footer={discardWarningFooter}
        size="small"
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
          Are you sure you want to discard your changes? This action cannot be undone.
        </p>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} onOverlayClick={handleClose} title="Update Space" footer={footer} size="medium">
      <form onSubmit={handleSubmit}>
        <FormGroup>
          <Label>
            Name <span style={{ color: '#d73a49' }}>*</span>
          </Label>
          <Input
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="My Space"
            maxLength={spaceConfig.name.maxLength}
            className={errors.name ? 'error' : ''}
            disabled={isSubmitting}
          />
          {errors.name && <Error>{errors.name}</Error>}
          {!errors.name && name && (
            <Hint>
              URL slug: /{generateSlug(name)} ({name.length}/{spaceConfig.name.maxLength})
            </Hint>
          )}
        </FormGroup>

        <FormGroup>
          <Label>Parent Space</Label>
          <SpaceSelector
            value={parentId}
            onChange={(value) => setParentId(value)}
            placeholder="None (Root Space)"
            error={!!errors.parent}
            disabled={isSubmitting}
            excludeSpaceId={space?.id}
          />
          {errors.parent && <Error>{errors.parent}</Error>}
          {!errors.parent && <Hint>Select a parent space or leave as root level</Hint>}
        </FormGroup>

        <FormGroup>
          <Label>Description</Label>
          <Textarea
            value={description}
            onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            placeholder="Optional description..."
            maxLength={spaceConfig.description.maxLength}
            disabled={isSubmitting}
          />
          {description && (
            <Hint>
              {description.length}/{spaceConfig.description.maxLength}
            </Hint>
          )}
        </FormGroup>
      </form>
    </Modal>
  );
}

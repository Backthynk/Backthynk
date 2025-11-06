import { useState, useEffect } from 'preact/hooks';
import { Modal, formStyles } from '../modal';
import { SpaceSelector } from '../SpaceSelector';
import { type Space } from '@core/api';
import { spaces, checkDuplicateSlug, validateParentSpace, canBeParent } from '@core/state';
import { generateSlug } from '@core/utils';
import { space as spaceConfig } from '@core/config';

const FormGroup = formStyles.formGroup;
const Label = formStyles.label;
const Input = formStyles.input;
const Textarea = formStyles.textarea;
const Error = formStyles.error;
const Hint = formStyles.hint;
const Button = formStyles.button;

interface ValidationErrors {
  name?: string;
  parent?: string;
}

interface SpaceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; parent_id: number | null }) => Promise<void>;
  mode: 'create' | 'update';
  initialData?: {
    name: string;
    description: string;
    parent_id: number | null;
    space_id?: number;
  };
  currentSpace?: Space | null;
}

export function SpaceFormModal({
  isOpen,
  onClose,
  onSubmit,
  mode,
  initialData,
  currentSpace,
}: SpaceFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardWarning, setShowDiscardWarning] = useState(false);

  const isCreateMode = mode === 'create';
  const title = isCreateMode ? 'Create New Space' : 'Update Space';
  const submitText = isCreateMode ? 'Create repository' : 'Update space';
  const submittingText = isCreateMode ? 'Creating...' : 'Updating...';

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Update mode - use initialData
        setName(initialData.name);
        setDescription(initialData.description || '');
        setParentId(initialData.parent_id);
      } else if (currentSpace && isCreateMode) {
        // Create mode - determine default parent based on currentSpace
        let defaultParent: number | null = null;

        if (currentSpace && canBeParent(currentSpace.id)) {
          defaultParent = currentSpace.id;
        }

        setName('');
        setDescription('');
        setParentId(defaultParent);
      } else {
        // Create mode without currentSpace
        setName('');
        setDescription('');
        setParentId(null);
      }
    } else {
      // Reset form when modal closes
      setName('');
      setDescription('');
      setParentId(null);
      setErrors({});
      setIsSubmitting(false);
      setShowDiscardWarning(false);
    }
  }, [isOpen, initialData, currentSpace, isCreateMode]);

  // Check if form has been modified
  const isFormDirty = () => {
    if (initialData) {
      // Update mode - check if values changed
      return (
        name.trim() !== initialData.name ||
        description.trim() !== (initialData.description || '') ||
        parentId !== initialData.parent_id
      );
    }
    // Create mode - check if any field has content
    return name.trim().length > 0 || description.trim().length > 0;
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

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Validate name
    const nameError = validateName(name);
    if (nameError) {
      newErrors.name = nameError;
    } else {
      // Check for duplicate slug
      const duplicateCheck = checkDuplicateSlug(name, parentId, initialData?.space_id);
      if (duplicateCheck.isDuplicate && duplicateCheck.conflictingSpace) {
        newErrors.name = `A space with this name already exists at this level (conflicts with "${duplicateCheck.conflictingSpace.name}")`;
      }
    }

    // Validate parent
    const parentValidation = validateParentSpace(parentId, initialData?.space_id);
    if (!parentValidation.isValid) {
      newErrors.parent = parentValidation.error;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Real-time validation on name change
  useEffect(() => {
    if (name) {
      const nameError = validateName(name);
      if (nameError) {
        setErrors((prev) => ({ ...prev, name: nameError }));
      } else {
        const duplicateCheck = checkDuplicateSlug(name, parentId, initialData?.space_id);
        if (duplicateCheck.isDuplicate && duplicateCheck.conflictingSpace) {
          setErrors((prev) => ({
            ...prev,
            name: `A space with this name already exists at this level (conflicts with "${duplicateCheck.conflictingSpace.name}")`,
          }));
        } else {
          setErrors((prev) => ({ ...prev, name: undefined }));
        }
      }
    } else {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  }, [name, parentId, initialData?.space_id]);

  // Real-time validation on parent change
  useEffect(() => {
    const parentValidation = validateParentSpace(parentId, initialData?.space_id);
    const duplicateCheck = name ? checkDuplicateSlug(name, parentId, initialData?.space_id) : null;

    setErrors((prev) => ({
      ...prev,
      parent: parentValidation.isValid ? undefined : parentValidation.error,
      name:
        duplicateCheck?.isDuplicate && duplicateCheck.conflictingSpace
          ? `A space with this name already exists at this level (conflicts with "${duplicateCheck.conflictingSpace.name}")`
          : prev.name && !prev.name.includes('conflicts with')
            ? prev.name
            : undefined,
    }));
  }, [parentId, name, initialData?.space_id]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        parent_id: parentId,
      });
      onClose();
    } catch (error) {
      console.error('Form submission failed:', error);
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
        {isSubmitting ? submittingText : submitText}
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
    <Modal isOpen={isOpen} onClose={handleClose} onOverlayClick={handleClose} title={title} footer={footer} size="medium">
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
            excludeSpaceId={initialData?.space_id}
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

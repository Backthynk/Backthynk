import { useState, useEffect } from 'preact/hooks';
import { Modal } from './Modal';
import { SearchableSelect, type SelectOption } from './SearchableSelect';
import { formStyles } from '../styles/modal';
import { createSpace, type Space } from '@core/api';
import { spaces } from '@core/state';
import { generateSlug } from '@core/utils';

const FormGroup = formStyles.formGroup;
const Label = formStyles.label;
const Input = formStyles.input;
const Textarea = formStyles.textarea;
const Error = formStyles.error;
const Hint = formStyles.hint;
const Button = formStyles.button;

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentSpace: Space | null;
}

// Validation constants matching backend (config.go)
const MAX_SPACE_NAME_LENGTH = 30;
const MAX_SPACE_DESCRIPTION_LENGTH = 280;
const SPACE_NAME_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9\s\-_'.])*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

interface ValidationErrors {
  name?: string;
  parent?: string;
}

export function CreateSpaceModal({ isOpen, onClose, onSuccess, currentSpace }: CreateSpaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardWarning, setShowDiscardWarning] = useState(false);

  // Set default parent when modal opens based on currentSpace
  useEffect(() => {
    if (isOpen) {
      // Determine default parent based on currentSpace
      let defaultParent: number | null = null;

      if (currentSpace) {
        // Check if currentSpace can be a parent (not at max depth)
        // If it has a parent_id, it's at level 1, so we can add children (level 2)
        // If it has no parent_id, it's at level 0 (root), so we can add children (level 1)
        const canBeParent = currentSpace.parent_id === null ||
          spaces.value.find(s => s.id === currentSpace.parent_id)?.parent_id === null;

        if (canBeParent) {
          defaultParent = currentSpace.id;
        } else {
          // Current space is at depth 2, can't add children, so use root (null)
          defaultParent = null;
        }
      }

      setParentId(defaultParent);
    } else {
      // Reset form when modal closes
      setName('');
      setDescription('');
      setParentId(null);
      setErrors({});
      setIsSubmitting(false);
      setShowDiscardWarning(false);
    }
  }, [isOpen, currentSpace]);

  // Check if form has been partially filled
  const isFormDirty = () => {
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

  // Build parent space options with hierarchy
  const buildSpaceOptions = (): SelectOption[] => {
    const allSpaces = spaces.value;
    const options: SelectOption[] = [{ value: null, label: 'None (Root Space)' }];

    // Get root spaces (no parent)
    const rootSpaces = allSpaces.filter((s) => s.parent_id === null);

    // Add root spaces and their children
    rootSpaces.forEach((rootSpace) => {
      options.push({
        value: rootSpace.id,
        label: rootSpace.name,
      });

      // Add children with indent
      const children = allSpaces.filter((s) => s.parent_id === rootSpace.id);
      children.forEach((child) => {
        options.push({
          value: child.id,
          label: `${rootSpace.name} / ${child.name}`,
          indent: true,
        });
      });
    });

    return options;
  };

  // Validate space name format
  const validateName = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Name is required';
    }

    if (value.length > MAX_SPACE_NAME_LENGTH) {
      return `Name must not exceed ${MAX_SPACE_NAME_LENGTH} characters`;
    }

    if (!SPACE_NAME_PATTERN.test(value)) {
      return 'Name must start with a letter or number, and can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, and periods';
    }

    return undefined;
  };

  // Check if slug/name already exists at the same level
  const checkDuplicateSlug = (value: string, parent: number | null): string | undefined => {
    const slug = generateSlug(value);
    const allSpaces = spaces.value;

    // Find spaces with the same parent
    const siblingsSpaces = allSpaces.filter((s) => s.parent_id === parent);

    // Check if any sibling has the same slug
    const duplicate = siblingsSpaces.find((s) => generateSlug(s.name) === slug);

    if (duplicate) {
      return `A space with this name already exists at this level (conflicts with "${duplicate.name}")`;
    }

    return undefined;
  };

  // Validate parent selection (check depth)
  const validateParent = (parent: number | null): string | undefined => {
    if (parent === null) return undefined;

    const parentSpace = spaces.value.find((s) => s.id === parent);
    if (!parentSpace) return 'Invalid parent space';

    // Check if parent already has a parent (max depth is 2 levels: root -> level 1 -> level 2)
    // So we can only add children to root (level 0) or level 1 spaces
    // If parent has a parent, it's at level 1, and we'd create level 2 (allowed)
    // We need to check if parent is at level 2 (has a grandparent)
    if (parentSpace.parent_id !== null) {
      const grandparent = spaces.value.find((s) => s.id === parentSpace.parent_id);
      if (grandparent && grandparent.parent_id !== null) {
        return 'Cannot create space: maximum depth (2 levels) would be exceeded';
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

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const newSpace = await createSpace({
        name: name.trim(),
        description: description.trim(),
        parent_id: parentId,
      });

      if (newSpace) {
        // Update local state
        spaces.value = [...spaces.value, newSpace];
        onSuccess();
        onClose();
      } else {
        setErrors({ name: 'Failed to create space' });
      }
    } catch (error) {
      console.error('Failed to create space:', error);
      setErrors({ name: 'Failed to create space. Please try again.' });
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
        {isSubmitting ? 'Creating...' : 'Create repository'}
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
    <Modal isOpen={isOpen} onClose={handleClose} onOverlayClick={handleClose} title="Create New Space" footer={footer} size="medium">
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
            maxLength={MAX_SPACE_NAME_LENGTH}
            className={errors.name ? 'error' : ''}
            disabled={isSubmitting}
          />
          {errors.name && <Error>{errors.name}</Error>}
          {!errors.name && name && (
            <Hint>
              URL slug: /{generateSlug(name)} ({name.length}/{MAX_SPACE_NAME_LENGTH})
            </Hint>
          )}
        </FormGroup>

        <FormGroup>
          <Label>Parent Space</Label>
          <SearchableSelect
            options={buildSpaceOptions()}
            value={parentId}
            onChange={(value) => setParentId(value as number | null)}
            placeholder="None (Root Space)"
            searchPlaceholder="Search spaces..."
            error={!!errors.parent}
            disabled={isSubmitting}
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
            maxLength={MAX_SPACE_DESCRIPTION_LENGTH}
            disabled={isSubmitting}
          />
          {description && (
            <Hint>
              {description.length}/{MAX_SPACE_DESCRIPTION_LENGTH}
            </Hint>
          )}
        </FormGroup>
      </form>
    </Modal>
  );
}

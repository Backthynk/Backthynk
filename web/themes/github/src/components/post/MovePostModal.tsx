import { useState, useEffect } from 'preact/hooks';
import { Modal, formStyles } from '../modal';
import { SpaceSelector } from '../SpaceSelector';
import { movePost, type Post } from '@core/api';
import { spaces } from '@core/state';
import { showSuccess, showError } from '@core/components';

const FormGroup = formStyles.formGroup;
const Label = formStyles.label;
const Button = formStyles.button;
const Hint = formStyles.hint;

interface MovePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  onSuccess: (updatedPost: Post) => void;
}

export function MovePostModal({ isOpen, onClose, post, onSuccess }: MovePostModalProps) {
  const [targetSpaceId, setTargetSpaceId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTargetSpaceId(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Get current space breadcrumb
  const getCurrentSpaceBreadcrumb = (): string => {
    if (!post) return '';

    const space = spaces.value.find(s => s.id === post.space_id);
    if (!space) return 'Unknown Space';

    const breadcrumbs: string[] = [];
    let current = space;

    while (current) {
      breadcrumbs.unshift(current.name);
      if (current.parent_id === null) break;
      current = spaces.value.find(s => s.id === current.parent_id)!;
    }

    return breadcrumbs.join(' / ');
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!post || targetSpaceId === null) {
      showError('Please select a space to move the post to');
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedPost = await movePost(post.id, targetSpaceId);

      if (updatedPost) {
        const targetSpace = spaces.value.find(s => s.id === targetSpaceId);
        const targetSpaceName = targetSpace ? targetSpace.name : 'selected space';

        showSuccess(`Post moved to ${targetSpaceName}`);
        onSuccess(updatedPost);
        onClose();
      } else {
        showError('Failed to move post');
      }
    } catch (error) {
      console.error('Failed to move post:', error);
      showError('Failed to move post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = targetSpaceId !== null && targetSpaceId !== post?.space_id;

  const footer = (
    <>
      <Button type="button" className="secondary" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button
        type="submit"
        className="primary"
        onClick={handleSubmit}
        disabled={!isFormValid || isSubmitting}
      >
        {isSubmitting ? 'Moving...' : 'Move Post'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onOverlayClick={onClose}
      title="Move Post"
      footer={footer}
      size="small"
    >
      <form onSubmit={handleSubmit}>
        <FormGroup>
          <Label>Current Space</Label>
          <div style={{
            padding: '0.5rem 0.75rem',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '6px'
          }}>
            {getCurrentSpaceBreadcrumb()}
          </div>
        </FormGroup>

        <FormGroup>
          <Label>
            Move to <span style={{ color: '#d73a49' }}>*</span>
          </Label>
          <SpaceSelector
            value={targetSpaceId}
            onChange={(value) => setTargetSpaceId(value)}
            placeholder="Select a space..."
            disabled={isSubmitting}
            excludeSpaceId={post?.space_id}
            showAllDepths={true}
          />
          <Hint>Select the space where you want to move this post</Hint>
        </FormGroup>
      </form>
    </Modal>
  );
}

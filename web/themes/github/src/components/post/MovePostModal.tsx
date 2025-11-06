import { useState, useEffect } from 'preact/hooks';
import { Modal, formStyles } from '../modal';
import { SpaceSelector } from '../SpaceSelector';
import { type Post } from '@core/api';
import { getSpaceBreadcrumb } from '@core/state';
import { showError } from '@core/components';
import { movePostAction } from '@core/actions/postActions';
import type { TimelineContext } from '../Timeline';

const FormGroup = formStyles.formGroup;
const Label = formStyles.label;
const Button = formStyles.button;
const Hint = formStyles.hint;

interface MovePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  timelineContext?: TimelineContext;
}

export function MovePostModal({ isOpen, onClose, post, timelineContext }: MovePostModalProps) {
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
    const breadcrumb = getSpaceBreadcrumb(post.space_id);
    return breadcrumb || 'Unknown Space';
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!post || targetSpaceId === null) {
      showError('Please select a space to move the post to');
      return;
    }

    setIsSubmitting(true);

    try {
      await movePostAction({
        postId: post.id,
        newSpaceId: targetSpaceId,
        currentSpaceId: timelineContext?.spaceId,
        recursive: timelineContext?.recursive,
      });

      onClose();
    } catch (error) {
      // Error handling is done in the action
      console.error('Move post action failed:', error);
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

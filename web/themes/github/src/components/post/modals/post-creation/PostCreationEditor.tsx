import { Ref } from 'preact';
import { postCreationModalStyles } from '../../../../styles/post-creation-modal';

const Container = postCreationModalStyles.container;
const Textarea = postCreationModalStyles.textarea;

interface PostCreationEditorProps {
  containerRef: Ref<HTMLDivElement>;
  textareaRef: Ref<HTMLTextAreaElement>;
  content: string;
  onContentChange: (content: string) => void;
  onDragEnter: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

export function PostCreationEditor({
  containerRef,
  textareaRef,
  content,
  onContentChange,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: PostCreationEditorProps) {
  return (
    <Container
      ref={containerRef}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <Textarea
        ref={textareaRef}
        value={content}
        onInput={(e) => onContentChange((e.target as HTMLTextAreaElement).value)}
        placeholder="What's on your mind?"
        rows={3}
        style={{ minHeight: '100px' }}
      />
    </Container>
  );
}

import { styled } from 'goober';

// Define styled components separately first
const Article = styled('article')`
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-top: none;
  border-radius: 0;
  padding: 1rem;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;

  &:first-child {
    border-top: 1px solid var(--border-primary);
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  &:last-child {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: var(--border-secondary);
    position: relative;
    z-index: 1;
  }
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;

  &.with-content {
    margin-bottom: 1rem;
  }
`;

const HeaderLeft = styled('div')`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Breadcrumb = styled('span')`
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--accent-primary);
  background: var(--bg-active);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-hover);
    transform: translateY(-1px);
  }
`;

const Timestamp = styled('div')`
  position: relative;
  display: inline-block;
  cursor: default;
`;

const TimestampText = styled('span')`
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: default;
`;

const ActionButton = styled('button')`
  opacity: 0;
  padding-left: 1rem;
  padding-top: 0.25rem;
  padding-bottom: 1rem;
  padding-right: 0.25rem;

  color: var(--text-tertiary);
  border-radius: 4px;
  transition: all 0.2s ease;

  ${Article}:hover & {
    opacity: 1;
  }

  &:hover {
    color: var(--text-secondary);
  }

  i {
    font-size: 0.875rem;
  }
`;

const Content = styled('div')`
  font-size: 15px;
  color: var(--text-primary);
  word-wrap: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  line-height: 1.6;

  a {
    color: var(--accent-primary);
    word-break: break-all;
    transition: color 0.2s ease;

    &:hover {
      color: var(--accent-hover);
      text-decoration: underline;
    }
  }
`;

const AttachmentsSection = styled('div')`
  border-top: 1px solid var(--border-primary);
  padding-top: 0.75rem;
  margin-top: 1rem;
`;

const AttachmentsHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const AttachmentsTitle = styled('h4')`
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
`;

const NavControls = styled('div')`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const NavButton = styled('button')`
  padding: 0.25rem;
  color: var(--text-tertiary);
  transition: color 0.2s ease;

  &:hover:not(:disabled) {
    color: var(--text-secondary);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  i {
    font-size: 0.75rem;
  }
`;

const NavCounter = styled('span')`
  font-size: 0.75rem;
  color: var(--text-tertiary);
`;

const AttachmentsContainer = styled('div')`
  position: relative;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
`;

const AttachmentsList = styled('div')`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: transform 0.3s ease-in-out;
  box-sizing: border-box;
`;

const FileOverlay = styled('div')`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
  padding: 0.25rem;
  border-radius: 0 0 8px 8px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.2s ease;

  p {
    color: white;
    font-size: 0.75rem;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .size {
    opacity: 0.8;
  }
`;

const Attachment = styled('div')`
  position: relative;
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    transition: opacity 0.2s ease;
  }

  &:hover img {
    opacity: 0.9;
  }

  &:hover ${FileOverlay} {
    opacity: 1;
  }
`;

const FilePreview = styled('div')`
  width: 100%;
  height: 100%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;

  &:hover {
    background: var(--bg-hover);
  }

  i {
    font-size: 1.5rem;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }

  span {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    font-weight: 500;
  }
`;

const LinkPreviewCard = styled('a')`
  display: flex;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  text-decoration: none;

  &:hover {
    border-color: var(--border-secondary);
    background: var(--bg-hover);
    text-decoration: none;
  }
`;

const LinkPreviewImage = styled('div')`
  flex-shrink: 0;
  width: 128px;
  align-self: stretch;

  & > div {
    width: 100%;
    height: 100%;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const LinkPreviewContent = styled('div')`
  flex: 1;
  padding: 1rem;
  min-width: 0;
`;

const LinkPreviewTitle = styled('h4')`
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const LinkPreviewDescription = styled('p')`
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const LinkPreviewMeta = styled('div')`
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-tertiary);

  i {
    margin-right: 0.25rem;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const ActionMenu = styled('div')`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.25rem;
  width: 128px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 50;
  animation: fadeInDown 0.15s ease-out;

  @keyframes fadeInDown {
    0% {
      opacity: 0;
      transform: translateY(-4px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const MenuButton = styled('button')`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: background 0.2s ease;

  &:hover {
    background: var(--bg-hover);
  }

  &.danger {
    color: #dc2626;

    &:hover {
      background: rgba(220, 38, 38, 0.1);
    }
  }

  i {
    font-size: 0.75rem;
    margin-right: 0.5rem;
  }
`;

// Export as object for compatibility
export const postStyles = {
  article: Article,
  header: Header,
  headerLeft: HeaderLeft,
  breadcrumb: Breadcrumb,
  timestamp: Timestamp,
  timestampText: TimestampText,
  actionButton: ActionButton,
  content: Content,
  attachmentsSection: AttachmentsSection,
  attachmentsHeader: AttachmentsHeader,
  attachmentsTitle: AttachmentsTitle,
  navControls: NavControls,
  navButton: NavButton,
  navCounter: NavCounter,
  attachmentsContainer: AttachmentsContainer,
  attachmentsList: AttachmentsList,
  attachment: Attachment,
  filePreview: FilePreview,
  fileOverlay: FileOverlay,
  linkPreviewCard: LinkPreviewCard,
  linkPreviewImage: LinkPreviewImage,
  linkPreviewContent: LinkPreviewContent,
  linkPreviewTitle: LinkPreviewTitle,
  linkPreviewDescription: LinkPreviewDescription,
  linkPreviewMeta: LinkPreviewMeta,
  actionMenu: ActionMenu,
  menuButton: MenuButton,
};

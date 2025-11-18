import { styled } from 'goober';

export const GalleryContainer = styled('div')`
  border-radius: 12px;
  overflow: hidden;
  margin-top: 0.75rem;
  border: 1px solid var(--border-primary);
`;

export const TwoImagesGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  max-height: 400px;

  & > div {
    width: 100%;
    height: 100%;
    max-height: 400px;
  }

  & > div:first-child {
    border-radius: 12px 0 0 12px;
  }

  & > div:last-child {
    border-radius: 0 12px 12px 0;
  }
`;

export const ThreeImagesGrid = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  max-height: 400px;
  height: 400px;

  & > div:first-child {
    grid-row: 1 / 3;
    grid-column: 1;
    border-radius: 12px 0 0 12px;
  }

  & > div:nth-child(2) {
    grid-row: 1;
    grid-column: 2;
    border-radius: 0 12px 0 0;
  }

  & > div:nth-child(3) {
    grid-row: 2;
    grid-column: 2;
    border-radius: 0 0 12px 0;
  }

  & > div {
    width: 100%;
    height: 100%;
  }
`;

export const FourImagesGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  max-height: 400px;
  height: 400px;

  & > div {
    width: 100%;
    height: 100%;
  }

  & > div:nth-child(1) {
    border-radius: 12px 0 0 0;
  }

  & > div:nth-child(2) {
    border-radius: 0 12px 0 0;
  }

  & > div:nth-child(3) {
    border-radius: 0 0 0 12px;
  }

  & > div:nth-child(4) {
    border-radius: 0 0 12px 0;
  }
`;

export const ImageContainer = styled('div')`
  position: relative;
  overflow: hidden;
  cursor: pointer;
  max-height: 500px;
  background: rgba(0, 0, 0, 0.015);

  .dark & {
    background: rgba(255, 255, 255, 0.015);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &:hover .file-overlay {
    opacity: 1;
  }

  &:hover .shadow-overlay {
    opacity: 1;
  }

  &:first-child:last-child {
    border-radius: 12px;
  }
`;

export const ShadowOverlay = styled('div')`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 30%, transparent 60%);
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 1;
`;

export const FileOverlay = styled('div')`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 30%, transparent 60%);
  padding: 0.5rem;
  border-radius: inherit;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 2;

  ${ImageContainer}:hover & {
    opacity: 1;
  }

  &.always-visible {
    opacity: 1;
  }

  /* Always show on mobile/tablet (can't hover) */
  @media (hover: none) {
    opacity: 1;
  }

  p {
    color: white;
    font-size: 0.875rem;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .size {
    opacity: 0.8;
    font-size: 0.75rem;
  }
`;

export const FilePlaceholder = styled('div')`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.015);
  min-height: 200px;

  .dark & {
    background: rgba(255, 255, 255, 0.015);
  }

  i {
    font-size: 3rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .file-type {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
  }
`;

export const FilePlaceholderFooter = styled('div')`
  position: absolute;
  inset: 0;
  padding: 0.75rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 30%, transparent 60%);
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: inherit;

  ${ImageContainer}:hover & {
    opacity: 1;
  }

  &.always-visible {
    opacity: 1;
  }

  /* Always show on mobile/tablet (can't hover) */
  @media (hover: none) {
    opacity: 1;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .size {
    opacity: 0.8;
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
`;

export const RemoveButton = styled('button')`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 10;

  &:hover {
    background: rgba(0, 0, 0, 0.9);
  }

  ${ImageContainer}:hover & {
    opacity: 1;
  }
`;

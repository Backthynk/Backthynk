import { styled } from 'goober';

interface GridProps {
  maxHeight: number;
  gap: number;
}

export const GalleryContainer = styled('div')`
  border-radius: 12px;
  overflow: hidden;
  margin-top: 0.75rem;
  border: 1px solid var(--border-primary);
`;

export const TwoImagesGrid = styled('div')<GridProps>`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${(props) => props.gap}px;
  max-height: ${(props) => props.maxHeight}px;
  height: ${(props) => props.maxHeight}px;

  & > div {
    width: 100%;
    height: 100%;
  }

  & > div:first-child {
    border-radius: 12px 0 0 12px;
  }

  & > div:last-child {
    border-radius: 0 12px 12px 0;
  }
`;

export const ThreeImagesGrid = styled('div')<GridProps>`
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: ${(props) => props.gap}px;
  max-height: ${(props) => props.maxHeight}px;
  height: ${(props) => props.maxHeight}px;

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

export const FourImagesGrid = styled('div')<GridProps>`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: ${(props) => props.gap}px;
  max-height: ${(props) => props.maxHeight}px;
  height: ${(props) => props.maxHeight}px;

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

export const ImageContainer = styled('div')<{ singleImage?: boolean; maxHeight?: number }>`
  position: relative;
  overflow: hidden;
  cursor: pointer;
  max-height: ${(props) => (props.singleImage && props.maxHeight ? `${props.maxHeight}px` : 'none')};
  height: ${(props) => (props.singleImage && props.maxHeight ? `${props.maxHeight}px` : '100%')};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &:first-child:last-child {
    border-radius: 12px;
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

  ${ImageContainer}:hover &,
  ${ImageContainer}:first-child:last-child:hover & {
    opacity: 1;
  }
`;

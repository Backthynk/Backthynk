import { styled } from 'goober';

export const AlertContainer = styled('div')`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 9999;
  pointer-events: none;
`;

export const AlertDropdown = styled('div')<{ type: 'success' | 'error' | 'warning' | 'info'; isVisible: boolean; isHiding: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px 16px;
  transform: translateY(-100%);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  opacity: 1;
  visibility: visible;

  ${props => props.type === 'success' && `
    background-color: #75C590;
    min-height: 16px;
  `}

  ${props => props.type === 'error' && `
    background-color: #E06E6B;
    min-height: 32px;
  `}

  ${props => props.type === 'warning' && `
    background-color: #EFB840;
    min-height: 32px;
  `}

  ${props => props.type === 'info' && `
    background-color: #74ACFF;
    min-height: 32px;
  `}

  ${props => props.isVisible && !props.isHiding && `
    transform: translateY(0);
  `}

  ${props => props.isHiding && `
    transform: translateY(-100%);
    transition: transform 0.25s cubic-bezier(0.55, 0.055, 0.675, 0.19);
  `}
`;

export const AlertText = styled('span')`
  color: white;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  line-height: 1.2;
`;

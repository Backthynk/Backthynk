import { useLocation } from 'preact-iso';
import { spaces, getSpaceById, isRecursiveMode } from '@core/state';
import type { Space } from '@core/api';
import { navigateToSpace } from '@core/actions/spaceActions';

interface TitleBreadcrumbProps {
  spaceId: number;
  size?: 'small' | 'large';
  showBadgeOnHover?: boolean;
}

export function TitleBreadcrumb({ spaceId, size = 'small', showBadgeOnHover = false }: TitleBreadcrumbProps) {
  const location = useLocation();
  const fontSize = size === 'large' ? '16px' : '13px';

  const navigate = (space: Space, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigateToSpace(space, location);
  };

  if (spaceId === 0) {
    return <div style={{ fontSize, fontWeight: 600 }}>All Spaces</div>;
  }

  const currentSpace = spaces.value.find((s) => s.id === spaceId);
  if (!currentSpace) {
    return <div style={{ fontSize }}>Unknown Space</div>;
  }

  const path: Space[] = [];
  let current: Space | undefined = currentSpace;
  while (current) {
    path.unshift(current);
    current = current.parent_id ? getSpaceById(current.parent_id) : undefined;
  }

  const linkStyle = {
    color: 'var(--accent-primary)',
    cursor: 'pointer',
    textDecoration: 'none',
  };

  const items: any[] = [];
  
  if (path.length > 2) {
    const parent = path[path.length - 2];
    const grandparent = path[path.length - 3];
    
    items.push(
      <a key="ellipsis" onClick={(e) => navigate(grandparent, e)} style={linkStyle} 
         onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-hover)'}
         onMouseOut={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}>...</a>,
      <span key="sep1" style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>{'>'}</span>,
      <a key={parent.id} onClick={(e) => navigate(parent, e)} style={linkStyle}
         onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-hover)'}
         onMouseOut={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}>{parent.name}</a>,
      <span key="sep2" style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>{'>'}</span>,
      <span key="current" style={{ fontWeight: 600 }}>{currentSpace.name}</span>
    );
  } else {
    path.forEach((s, i) => {
      if (i > 0) {
        items.push(<span key={`sep-${s.id}`} style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>{'>'}</span>);
      }
      
      if (i === path.length - 1) {
        items.push(<span key={s.id} style={{ fontWeight: 600 }}>{s.name}</span>);
      } else {
        items.push(
          <a key={s.id} onClick={(e) => navigate(s, e)} style={linkStyle}
             onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-hover)'}
             onMouseOut={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}>{s.name}</a>
        );
      }
    });
  }

  const isRecursive = spaceId !== 0 && isRecursiveMode(spaceId);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <div style={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        fontSize,
        fontWeight: 600,
        lineHeight: '1.4',
      }}>
        {items}
      </div>
      {(isRecursive || showBadgeOnHover) && (
        <div style={{
          fontSize: '9px',
          fontWeight: 600,
          color: 'var(--accent-recursive)',
          background: 'var(--accent-recursive-hover)',
          padding: '2px 6px',
          borderRadius: '4px',
          flexShrink: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          opacity: showBadgeOnHover && !isRecursive ? 0.5 : 1,
          transition: 'opacity 0.2s ease-in-out',
        }}>
          R
        </div>
      )}
    </div>
  );
}
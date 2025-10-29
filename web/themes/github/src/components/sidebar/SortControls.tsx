import { sidebarStyles } from '../../styles/sidebar';

const Footer = sidebarStyles.footer;
const SortOptions = sidebarStyles.sortOptions;
const SortButton = sidebarStyles.sortButton;

export type SortField = 'name' | 'posts' | 'created';

export interface SortPreference {
  field: SortField;
  ascending: boolean;
}

interface SortControlsProps {
  sortPref: SortPreference;
  onSort: (field: SortField) => void;
}

export function SortControls({ sortPref, onSort }: SortControlsProps) {
  const getSortIcon = (field: SortField) => {
    if (sortPref.field !== field) return 'fa-sort';

    if (field === 'name') {
      return sortPref.ascending ? 'fa-sort-alpha-down' : 'fa-sort-alpha-up';
    }
    return sortPref.ascending ? 'fa-sort-numeric-down' : 'fa-sort-numeric-up';
  };

  return (
    <Footer>
      <SortOptions>
        <SortButton
          className={sortPref.field === 'name' ? 'active' : ''}
          onClick={() => onSort('name')}
        >
          <span>Name</span>
          <i class={`fas ${getSortIcon('name')}`} />
        </SortButton>
        <SortButton
          className={sortPref.field === 'posts' ? 'active' : ''}
          onClick={() => onSort('posts')}
        >
          <span>Posts</span>
          <i class={`fas ${getSortIcon('posts')}`} />
        </SortButton>
        <SortButton
          className={sortPref.field === 'created' ? 'active' : ''}
          onClick={() => onSort('created')}
        >
          <span>Created</span>
          <i class={`fas ${getSortIcon('created')}`} />
        </SortButton>
      </SortOptions>
    </Footer>
  );
}

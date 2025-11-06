import { companionStyles } from '../../styles/companion';

const SearchContainer = companionStyles.searchContainer;
const SearchInput = companionStyles.searchInput;

export function SearchSection() {
  return (
    <SearchContainer>
      <SearchInput
        type="text"
        placeholder="Coming soon..."
        disabled
        readonly
      />
    </SearchContainer>
  );
}

import { LocationProvider, Router, Route } from 'preact-iso';
import { useEffect } from 'preact/hooks';

// Pages
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

// Core state initialization
import { initializeTheme, loadExpandedSpaces, loadRecursiveModes } from '@core/state';
import { DropdownAlert, GlobalConfirmModal } from '@core/components';
import { ConfirmModal } from './components/modal/ConfirmModal';

export function App() {
  useEffect(() => {
    // Initialize theme and load persisted state on mount
    initializeTheme();
    loadExpandedSpaces();
    loadRecursiveModes();
  }, []);

  return (
    <>
      <DropdownAlert />
      <GlobalConfirmModal ConfirmModalComponent={ConfirmModal} />
      <LocationProvider>
        <Router>
          <Route path="/" component={Home} />
          <Route path="/:spacePath*" component={Home} />
          <Route default component={NotFound} />
        </Router>
      </LocationProvider>
    </>
  );
}

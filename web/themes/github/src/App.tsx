import { LocationProvider, Router, Route } from 'preact-iso';
import { useEffect } from 'preact/hooks';

// Pages
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

// Core state initialization
import { initializeTheme } from '@core/state';
import { DropdownAlert } from '@core/components';
import { GlobalConfirmModal } from '@core/actions/GlobalConfirmModal';

export function App() {
  useEffect(() => {
    // Initialize theme on mount
    initializeTheme();
  }, []);

  return (
    <>
      <DropdownAlert />
      <GlobalConfirmModal />
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

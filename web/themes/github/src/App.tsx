import { LocationProvider, Router, Route } from 'preact-iso';
import { useEffect } from 'preact/hooks';

// Pages
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

// Core state initialization
import { loadAppSettings, appSettings, initializeTheme } from '@core/state';
import { DropdownAlert } from '@core/components';

export function App() {
  useEffect(() => {
    // Initialize theme on mount
    initializeTheme();

    // Load app settings on mount
    loadAppSettings().then((settings) => {
      appSettings.value = settings;

      // Update document title if available
      if (settings.siteTitle) {
        document.title = settings.siteTitle;
      }
    });
  }, []);

  return (
    <>
      <DropdownAlert />
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

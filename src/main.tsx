import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initI18n } from './i18n';
import { AppProvider } from './state/AppContext';
import { createServices } from './state/services';
import { initTheme } from './theme/theme';
import { App } from './ui/App';
import './theme/tokens.css';
import './ui/app.css';

async function start() {
  initTheme();
  await initI18n();
  const root = createRoot(document.getElementById('root')!);
  try {
    const services = await createServices();
    root.render(
      <StrictMode>
        <AppProvider services={services}>
          <App />
        </AppProvider>
      </StrictMode>,
    );
  } catch (e) {
    root.render(
      <main className="app" style={{ paddingBlockStart: '2rem' }}>
        <div className="banner banner--danger" role="alert">
          {(e as Error).message}
        </div>
      </main>,
    );
  }
}

void start();

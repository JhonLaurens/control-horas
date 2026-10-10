import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { ToastProvider } from './components/Toasts';
import { ConfirmProvider } from './components/Confirm';
import { StoreProvider } from './lib/store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </ConfirmProvider>
    </ToastProvider>
  </StrictMode>,
);

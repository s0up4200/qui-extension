import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@radix-ui/themes/styles.css';
import '@/assets/options.css';
import { Theme } from '@radix-ui/themes';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Theme appearance="dark" accentColor="blue" grayColor="slate" radius="medium">
      <App />
    </Theme>
  </React.StrictMode>,
);

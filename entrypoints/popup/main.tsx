import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@/assets/popup.css';
import { Theme } from '@radix-ui/themes';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Theme appearance="dark" accentColor="blue" grayColor="slate" radius="medium">
      <App />
    </Theme>
  </React.StrictMode>,
);

import React from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { StoreProvider } from './store'
import AppShell from './AppShell'

createRoot(document.getElementById('app-root')).render(
  <React.StrictMode>
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  </React.StrictMode>,
)
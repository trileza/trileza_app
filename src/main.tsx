import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import { TenantProvider } from './lib/tenantContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <TenantProvider>
        <App />
      </TenantProvider>
    </Router>
  </StrictMode>,
)




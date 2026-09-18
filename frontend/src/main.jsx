import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthenticationProvider } from './auth/auth-provider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthenticationProvider>
      <App />
    </AuthenticationProvider>
  </StrictMode>,
)

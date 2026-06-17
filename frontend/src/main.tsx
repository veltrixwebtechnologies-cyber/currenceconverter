import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  console.warn(
    '[HoverConvert] VITE_CLERK_PUBLISHABLE_KEY is not set. ' +
    'Authentication features will be disabled. ' +
    'Add it to your .env file to enable Clerk auth.'
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    ) : (
      // Fallback render without Clerk (free tier only mode)
      <App />
    )}
  </StrictMode>,
)

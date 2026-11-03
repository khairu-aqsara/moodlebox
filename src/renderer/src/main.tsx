import '@fontsource/red-hat-display/600.css'
import '@fontsource/red-hat-text/400.css'
import '@fontsource/red-hat-text/500.css'
import '@fontsource/red-hat-mono/400.css'
import '@fontsource/red-hat-mono/500.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

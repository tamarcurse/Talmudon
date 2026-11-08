import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CalendarProvider } from './context/CalendarContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CalendarProvider>
      <App />
    </CalendarProvider>
  </StrictMode>,
)

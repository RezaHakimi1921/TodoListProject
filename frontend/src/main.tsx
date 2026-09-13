import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ConfirmProvider } from './components/ConfirmProvider'
import App from './App'
import { registerPhonePushWorker, restorePhonePushIfAllowed } from './lib/phonePush'
import './lib/theme'
import './index.css'

void registerPhonePushWorker()
  .then(() => restorePhonePushIfAllowed())
  .catch(() => undefined)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 3000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

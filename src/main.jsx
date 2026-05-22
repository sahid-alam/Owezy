import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import { incrementSessionCount } from './lib-web/install-prompt.js'

incrementSessionCount()

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err) => {
      if (err?.message === 'OFFLINE') {
        toast("You're offline — try again when connected", { icon: '📵', id: 'offline-mutation' })
      }
    },
  }),
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

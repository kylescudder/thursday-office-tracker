import { createFileRoute } from '@tanstack/react-router'
import Index from '@/pages/Index'

export const Route = createFileRoute('/')({
  // The page reads the saved voter name from localStorage while rendering,
  // so it renders in the browser only, as it did before.
  ssr: false,
  component: Index
})

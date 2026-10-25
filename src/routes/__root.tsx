import { StrictMode, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute
} from '@tanstack/react-router'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@/server/trpc'
import { TRPCProvider } from '@/lib/trpc'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppBar from '@/components/AppBar'
import NotFound from '@/components/NotFound'
import '@/index.css'

const title = 'Thursday Office Vibes | Office Attendance Tracker'
const description =
  "Track Thursday office attendance with your squad. Vote on your weekly office plans and see who's coming in."

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title },
      { name: 'description', content: description },
      { name: 'author', content: 'Thursday Office Vibes' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@kylescudder97' }
    ],
    links: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
  }),
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: NotFound
})

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: '/api/trpc' })]
    })
  )
  return (
    <StrictMode>
      <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AppBar />
              <Outlet />
            </TooltipProvider>
          </TRPCProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

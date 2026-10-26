import { createFileRoute } from '@tanstack/react-router'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/trpc'

const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter
  })

export const Route = createFileRoute('/api/trpc/$')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request)
    }
  }
})

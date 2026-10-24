export type VoteOption = 'yes' | 'no' | 'could-be-convinced'

export interface ApiVote {
  name: string
  option: VoteOption
  timestamp: number // Unix timestamp (ms)
}

export interface ApiWeek {
  weekStart: number // Unix timestamp (ms)
  votes: ApiVote[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  })
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  getCurrentWeekVotes: () => request<ApiVote[]>('/votes/current'),
  getVoteHistory: () => request<ApiWeek[]>('/votes/history'),
  addVote: (body: { name: string; option: VoteOption }) =>
    request<{ id: number }>('/votes', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  deleteVote: (body: { name: string }) =>
    request<void>('/votes', { method: 'DELETE', body: JSON.stringify(body) })
}

import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc'
import type { VoteOption } from '@/server/votes'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { VoteHistory } from '@/components/VoteHistory'
import { CurrentVotes } from '@/components/CurrentVotes'

const Index = () => {
  const [userName, setUserName] = useState(
    () => localStorage.getItem('thursdayVoteName') || ''
  )

  // Queries poll so everyone sees new votes without refreshing
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: currentWeekVotesRaw } = useQuery(
    trpc.votes.current.queryOptions(undefined, { refetchInterval: 5000 })
  )
  const { data: weekHistoryRaw } = useQuery(
    trpc.votes.history.queryOptions(undefined, { refetchInterval: 30000 })
  )
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: trpc.votes.pathKey() })
  const { mutateAsync: addVote } = useMutation(
    trpc.votes.add.mutationOptions({ onSuccess })
  )
  const { mutateAsync: deleteVote } = useMutation(
    trpc.votes.remove.mutationOptions({ onSuccess })
  )

  // Convert timestamps to Date objects
  const currentWeekVotes = useMemo(() => {
    if (!currentWeekVotesRaw) return []
    return currentWeekVotesRaw.map((vote) => ({
      ...vote,
      timestamp: new Date(vote.timestamp)
    }))
  }, [currentWeekVotesRaw])

  const weekHistory = useMemo(() => {
    if (!weekHistoryRaw) return []
    return weekHistoryRaw.map((week) => ({
      weekStart: new Date(week.weekStart),
      votes: week.votes.map((v) => ({
        ...v,
        timestamp: new Date(v.timestamp)
      }))
    }))
  }, [weekHistoryRaw])

  const hasVoted = currentWeekVotes.some((vote) => vote.name === userName)

  // Save name to localStorage whenever it changes
  const handleNameChange = (newName: string) => {
    setUserName(newName)
    if (newName.trim()) {
      localStorage.setItem('thursdayVoteName', newName)
    }
  }

  const handleVote = async (option: VoteOption) => {
    if (!userName.trim()) {
      toast({
        title: 'Hold up!',
        description: 'Enter your name first, friend 👋',
        variant: 'destructive'
      })
      return
    }

    try {
      await addVote({ name: userName, option })

      const optionText = {
        yes: 'Sign me up! 🔥',
        no: 'No thank you 🏠',
        'could-be-convinced': 'I could be convinced! 👥'
      }

      toast({
        title: 'Vote recorded!',
        description: optionText[option]
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to record vote. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleChangeVote = async () => {
    try {
      await deleteVote({ name: userName })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to change vote. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const getThisThursday = () => {
    const today = new Date()
    const thursday = new Date(today)
    const day = today.getDay()
    const daysUntilThursday = (4 - day + 7) % 7
    thursday.setDate(today.getDate() + daysUntilThursday)
    return thursday.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className='bg-background min-h-screen px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-5xl space-y-8'>
        {/* Header */}
        <div className='space-y-3 text-center'>
          <h1 className='from-primary via-secondary to-accent bg-linear-to-r bg-clip-text p-1 text-5xl font-bold text-transparent sm:text-6xl'>
            Thursday Office Vibes
          </h1>
          <p className='text-muted-foreground text-xl'>{getThisThursday()}</p>
        </div>

        {/* Main Voting Card */}
        <Card className='border-2 shadow-(--shadow-card)'>
          <CardHeader>
            <CardTitle className='text-2xl'>
              Will you be in the office?
            </CardTitle>
            <CardDescription>
              Plan Thursday together and see who’s coming in.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            {!hasVoted && (
              <div className='space-y-2'>
                <Label htmlFor='name'>Your Name</Label>
                <Input
                  id='name'
                  placeholder='Enter your name...'
                  value={userName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className='text-lg'
                />
              </div>
            )}

            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <Button
                variant='vote'
                onClick={() => handleVote('yes')}
                disabled={hasVoted}
                className='bg-primary hover:bg-primary/90 text-primary-foreground min-h-36 flex-col gap-4 px-10 py-10 text-xl leading-tight whitespace-normal'
              >
                <span className='text-3xl leading-none'>🔥</span>
                <span className='px-1'>Sign me up</span>
              </Button>

              <Button
                variant='vote'
                onClick={() => handleVote('no')}
                disabled={hasVoted}
                className='bg-secondary hover:bg-secondary/80 text-secondary-foreground min-h-36 flex-col gap-4 px-10 py-10 text-xl leading-tight whitespace-normal'
              >
                <span className='text-3xl leading-none'>🏠</span>
                <span className='px-1'>No thank you</span>
              </Button>

              <Button
                variant='vote'
                onClick={() => handleVote('could-be-convinced')}
                disabled={hasVoted}
                className='bg-accent hover:bg-accent/80 text-accent-foreground min-h-36 flex-col gap-4 px-10 py-10 text-xl leading-tight whitespace-normal'
              >
                <span className='text-3xl leading-none'>👥</span>
                <span className='px-1'>I could be convinced</span>
              </Button>
            </div>

            {hasVoted && (
              <div className='text-center'>
                <Button
                  variant='ghost'
                  onClick={handleChangeVote}
                  className='text-muted-foreground hover:text-foreground'
                >
                  Change your vote
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Week Votes */}
        <CurrentVotes votes={currentWeekVotes} />

        {/* Vote History */}
        <VoteHistory weekHistory={weekHistory} />
      </div>
    </div>
  )
}

export default Index

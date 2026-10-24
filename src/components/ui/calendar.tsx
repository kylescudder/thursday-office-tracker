import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { DayPicker } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100'
        ),
        ...classNames
      }}
      components={{
        Chevron: ({ className, orientation = 'left' }) => {
          const Icon = {
            left: ChevronLeft,
            right: ChevronRight,
            up: ChevronUp,
            down: ChevronDown
          }[orientation]
          return <Icon className={cn('h-4 w-4', className)} />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }

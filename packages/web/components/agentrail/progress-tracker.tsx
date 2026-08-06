import { Check, CircleDot, FileCheck2, Lock, PlusCircle } from 'lucide-react'
import { JOB_STEPS, type JobStep } from '@/lib/agentrail-data'
import { cn } from '@/lib/utils'

const STEP_META: Record<
  JobStep,
  { icon: React.ReactNode; description: string }
> = {
  Open: { icon: <PlusCircle className="size-4" />, description: 'Job posted' },
  Funded: { icon: <Lock className="size-4" />, description: 'Escrow locked' },
  Submitted: {
    icon: <FileCheck2 className="size-4" />,
    description: 'Deliverable sent',
  },
  Terminal: { icon: <Check className="size-4" />, description: 'Settled' },
}

export function ProgressTracker({ currentStep }: { currentStep: JobStep }) {
  const currentIndex = JOB_STEPS.indexOf(currentStep)

  return (
    <ol className="flex flex-col gap-0 md:flex-row md:gap-0">
      {JOB_STEPS.map((step, index) => {
        const isComplete = index < currentIndex
        const isCurrent = index === currentIndex
        const isLast = index === JOB_STEPS.length - 1
        const meta = STEP_META[step]

        return (
          <li
            key={step}
            className="flex flex-1 gap-3 md:flex-col md:gap-0"
          >
            {/* Node + connector row */}
            <div className="flex flex-col items-center md:flex-row">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isComplete &&
                    'border-success/40 bg-success/15 text-success',
                  isCurrent &&
                    'border-primary bg-primary/15 text-primary ring-4 ring-primary/20',
                  !isComplete &&
                    !isCurrent &&
                    'border-border bg-secondary/60 text-muted-foreground',
                )}
              >
                {isComplete ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : isCurrent ? (
                  <CircleDot className="size-4" aria-hidden="true" />
                ) : (
                  meta.icon
                )}
              </span>

              {!isLast && (
                <span
                  className={cn(
                    'my-1 w-px flex-1 md:mx-2 md:my-0 md:h-px md:w-full md:min-w-8',
                    index < currentIndex ? 'bg-success/50' : 'bg-border',
                  )}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Label */}
            <div className="pb-6 md:pb-0 md:pt-3">
              <p
                className={cn(
                  'text-sm font-medium',
                  isCurrent
                    ? 'text-foreground'
                    : isComplete
                      ? 'text-foreground/90'
                      : 'text-muted-foreground',
                )}
              >
                {step}
              </p>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

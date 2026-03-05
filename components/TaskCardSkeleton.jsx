'use client'

/**
 * TaskCardSkeleton — Shimmer loading placeholder that mimics TaskCard layout.
 * Renders pulsing bars matching the card's visual structure.
 *
 * @param {Object} props
 * @param {boolean} [props.compact=false] — render compact variant
 */
export default function TaskCardSkeleton({ compact = false }) {
  if (compact) {
    return (
      <div className="task-card-skeleton p-2 rounded-md bg-dark-700/50 border border-dark-500/50 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-dark-500/80 shrink-0" />
          <div className="h-2.5 bg-dark-500/60 rounded w-3/4" />
          <div className="ml-auto w-8 h-2 bg-dark-500/40 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="task-card-skeleton rounded-lg border border-dark-500/50 bg-dark-700/40 p-3 space-y-2.5 animate-pulse">
      {/* Top row: priority dot + title */}
      <div className="flex items-start gap-2">
        <div className="w-2 h-2 rounded-full bg-dark-500/80 shrink-0 mt-1" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-dark-500/60 rounded w-4/5" />
          <div className="h-2.5 bg-dark-500/40 rounded w-3/5" />
        </div>
      </div>
      {/* Middle: description placeholder */}
      <div className="space-y-1.5 pl-4">
        <div className="h-2 bg-dark-500/30 rounded w-full" />
        <div className="h-2 bg-dark-500/30 rounded w-2/3" />
      </div>
      {/* Bottom row: badges + time */}
      <div className="flex items-center gap-2 pl-4">
        <div className="h-4 w-12 bg-dark-500/40 rounded-md" />
        <div className="h-4 w-10 bg-dark-500/30 rounded-md" />
        <div className="ml-auto h-3 w-14 bg-dark-500/30 rounded" />
      </div>
    </div>
  )
}

/**
 * SkeletonColumn — A full column of skeleton cards for loading state.
 *
 * @param {Object} props
 * @param {number} [props.count=3] — number of skeleton cards
 * @param {boolean} [props.compact=false] — compact mode
 */
export function SkeletonColumn({ count = 3, compact = false }) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-3'}>
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} compact={compact} />
      ))}
    </div>
  )
}

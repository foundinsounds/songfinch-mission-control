'use client'

/**
 * EmptyState — Illustrated empty state for when lists/views have no data
 *
 * Variants:
 *   - tasks: No tasks in queue
 *   - content: No content pieces
 *   - activity: No recent activity
 *   - agents: No agents configured
 *   - search: No search results
 *   - error: Something went wrong
 *   - generic: Default catch-all
 *
 * Usage:
 *   <EmptyState variant="tasks" />
 *   <EmptyState variant="search" message="No results for 'widget'" action={{ label: 'Clear Search', onClick: clearFn }} />
 */

const VARIANTS = {
  list: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <line x1="16" y1="20" x2="48" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="32" x2="48" y2="32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="44" x2="38" y2="44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="20" r="2" fill="currentColor" opacity="0.3"/>
        <circle cx="10" cy="32" r="2" fill="currentColor" opacity="0.3"/>
        <circle cx="10" cy="44" r="2" fill="currentColor" opacity="0.3"/>
      </svg>
    ),
    title: 'No tasks to display',
    message: 'Tasks matching your filters will appear here.',
  },
  inbox: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <polyline points="52 32 40 32 36 40 28 40 24 32 12 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M18 18l-6 14v12a4 4 0 0 0 4 4h32a4 4 0 0 0 4-4V32l-6-14a4 4 0 0 0-3.6-2.2H21.6A4 4 0 0 0 18 18z" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    title: 'Inbox zero!',
    message: 'All caught up. New notifications will appear here.',
  },
  calendar: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <rect x="10" y="14" width="44" height="40" rx="4" stroke="currentColor" strokeWidth="2"/>
        <line x1="22" y1="10" x2="22" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="42" y1="10" x2="42" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="10" y1="26" x2="54" y2="26" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    title: 'Nothing scheduled',
    message: 'Content deadlines and milestones will appear here.',
  },
  approvals: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="2"/>
        <polyline points="24 32 30 38 42 26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Nothing to approve',
    message: 'Content awaiting your review will appear here.',
  },
  campaigns: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <path d="M12 32h8l6 16 8-32 6 16h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'No campaigns yet',
    message: 'Create a campaign to orchestrate multi-channel content.',
  },
  tasks: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <rect x="12" y="8" width="40" height="48" rx="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M20 24h24M20 32h24M20 40h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <circle cx="44" cy="48" r="12" fill="currentColor" opacity="0.1"/>
        <path d="M40 48l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'No tasks in queue',
    message: 'All caught up! Run the agents or plan a campaign to generate new tasks.',
  },
  content: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <rect x="8" y="12" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M8 24l20 12 28-18" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
        <circle cx="24" cy="28" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
        <rect x="32" y="30" width="16" height="2" rx="1" fill="currentColor" opacity="0.2"/>
        <rect x="32" y="35" width="12" height="2" rx="1" fill="currentColor" opacity="0.15"/>
      </svg>
    ),
    title: 'No content yet',
    message: 'Content will appear here as agents complete creative tasks.',
  },
  activity: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="2"/>
        <path d="M32 16v16l10 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="32" cy="32" r="3" fill="currentColor" opacity="0.3"/>
      </svg>
    ),
    title: 'No recent activity',
    message: 'Activity will appear here as agents work on tasks.',
  },
  agents: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <circle cx="32" cy="24" r="10" stroke="currentColor" strokeWidth="2"/>
        <path d="M16 52c0-8.8 7.2-16 16-16s16 7.2 16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="28" cy="22" r="2" fill="currentColor" opacity="0.4"/>
        <circle cx="36" cy="22" r="2" fill="currentColor" opacity="0.4"/>
        <path d="M27 28c0 0 2 3 5 3s5-3 5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
      </svg>
    ),
    title: 'No agents found',
    message: 'Configure your AI agents in the settings panel to get started.',
  },
  search: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <circle cx="28" cy="28" r="14" stroke="currentColor" strokeWidth="2"/>
        <path d="M38 38l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M22 28h12M28 22v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
      </svg>
    ),
    title: 'No results found',
    message: 'Try adjusting your search or filters.',
  },
  error: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <path d="M32 8L4 56h56L32 8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M32 24v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="32" cy="44" r="2" fill="currentColor"/>
      </svg>
    ),
    title: 'Something went wrong',
    message: 'An error occurred. Please try again or check the console.',
  },
  generic: {
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <rect x="12" y="12" width="40" height="40" rx="8" stroke="currentColor" strokeWidth="2"/>
        <circle cx="32" cy="32" r="4" fill="currentColor" opacity="0.3"/>
        <path d="M24 24l16 16M40 24L24 40" stroke="currentColor" strokeWidth="1" opacity="0.15"/>
      </svg>
    ),
    title: 'Nothing here',
    message: 'This section is empty.',
  },
}

export default function EmptyState({
  variant = 'generic',
  title,
  message,
  action,
  compact = false,
  className = '',
}) {
  const config = VARIANTS[variant] || VARIANTS.generic

  return (
    <div className={`flex flex-col items-center justify-center text-center ${
      compact ? 'py-6 px-4' : 'py-12 px-6'
    } ${className}`}>
      <div className={`text-gray-500 animate-empty-state-float ${compact ? 'mb-2' : 'mb-4'}`}>
        {config.icon}
      </div>

      <h4 className={`font-semibold text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>
        {title || config.title}
      </h4>

      <p className={`text-gray-600 mt-1 max-w-xs ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {message || config.message}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className={`mt-3 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all
            bg-accent-orange/10 text-accent-orange border border-accent-orange/20
            hover:bg-accent-orange/20 hover:border-accent-orange/40`}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

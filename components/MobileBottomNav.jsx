'use client'

const NAV_ITEMS = [
  {
    key: 'kanban',
    label: 'Board',
    badgeKey: 'board',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: 'inbox',
    label: 'Inbox',
    badgeKey: 'inbox',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
  },
  {
    key: 'approvals',
    label: 'Review',
    badgeKey: 'review',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    key: 'agents',
    label: 'Agents',
    badgeKey: 'agents',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: 'more',
    label: 'More',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
      </svg>
    ),
  },
]

const BADGE_COLORS = {
  review: 'bg-red-500',
  inbox: 'bg-accent-orange',
  board: 'bg-accent-blue',
  agents: 'bg-accent-green',
}

export default function MobileBottomNav({
  currentView,
  onViewChange,
  inReview = 0,
  inboxCount = 0,
  boardCount = 0,
  agentsActive = 0,
}) {
  const getBadgeCount = (badgeKey) => {
    switch (badgeKey) {
      case 'review': return inReview
      case 'inbox': return inboxCount
      case 'board': return boardCount
      case 'agents': return agentsActive
      default: return 0
    }
  }

  return (
    <nav className="md:hidden mobile-bottom-bar bg-dark-800 border-t border-dark-500 flex items-center justify-around px-1">
      {NAV_ITEMS.map(item => {
        const isActive = item.key === 'more'
          ? !['kanban', 'inbox', 'approvals', 'agents'].includes(currentView)
          : currentView === item.key
        const badgeCount = item.badgeKey ? getBadgeCount(item.badgeKey) : 0
        const badgeColor = BADGE_COLORS[item.badgeKey] || 'bg-gray-500'

        return (
          <button
            key={item.key}
            onClick={() => {
              if (item.key === 'more') {
                // Cycle through useful views on tap
                const moreViews = ['list', 'analytics', 'calendar', 'campaigns', 'content']
                const currentIdx = moreViews.indexOf(currentView)
                const nextView = moreViews[(currentIdx + 1) % moreViews.length]
                onViewChange(nextView)
              } else {
                onViewChange(item.key)
              }
            }}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all relative min-w-[56px] ${
              isActive
                ? 'text-accent-orange'
                : 'text-gray-500 active:text-gray-300'
            }`}
          >
            <div className="relative">
              {item.icon}
              {badgeCount > 0 && (
                <span className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 ${badgeColor} text-white text-[8px] font-bold rounded-full flex items-center justify-center px-1 ${item.badgeKey === 'review' ? 'badge-pulse' : ''}`}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </div>
            <span className={`text-[9px] mt-0.5 font-medium ${isActive ? 'text-accent-orange' : 'text-gray-600'}`}>
              {item.key === 'more' && isActive
                ? currentView.charAt(0).toUpperCase() + currentView.slice(1)
                : item.label}
            </span>
            {isActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-accent-orange rounded-full" />
            )}
          </button>
        )
      })}
    </nav>
  )
}

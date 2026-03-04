'use client'

export default function StatsHeader({ stats, currentTime, dataSource, lastSync }) {
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).toUpperCase()
  }

  return (
    <header className="bg-dark-800 border-b border-dark-500 px-6 py-3 flex items-center justify-between shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent-orange">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-lg font-bold tracking-tight">MISSION CONTROL</span>
        </div>
        <div className="bg-dark-600 px-3 py-1 rounded-md text-xs font-medium text-gray-400">
          Songfinch
        </div>
      </div>

      {/* Center: Key Stats */}
      <div className="flex items-center gap-12">
        <div className="text-center">
          <div className="text-3xl font-bold">{stats.agentsActive}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Agents Active</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{stats.tasksInQueue}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Tasks in Queue</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-accent-orange">{stats.inReview}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">In Review</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-accent-green">{stats.completed}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Completed</div>
        </div>
      </div>

      {/* Right: Clock & Status */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xl font-mono font-bold tracking-wider">{formatTime(currentTime)}</div>
          <div className="text-[10px] text-gray-500 tracking-wider">{formatDate(currentTime)}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 bg-dark-600 px-3 py-1.5 rounded-md">
            <div className={`w-2 h-2 rounded-full pulse-dot ${dataSource === 'airtable' ? 'bg-accent-green' : dataSource === 'mock' ? 'bg-accent-yellow' : 'bg-gray-500'}`}></div>
            <span className={`text-xs font-semibold ${dataSource === 'airtable' ? 'text-accent-green' : dataSource === 'mock' ? 'text-accent-yellow' : 'text-gray-500'}`}>
              {dataSource === 'airtable' ? 'LIVE' : dataSource === 'mock' ? 'OFFLINE' : 'CONNECTING'}
            </span>
          </div>
          {dataSource === 'airtable' && (
            <span className="text-[9px] text-gray-600">King Claude</span>
          )}
        </div>
      </div>
    </header>
  )
}

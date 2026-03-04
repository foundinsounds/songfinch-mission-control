'use client'

import { GOOGLE_DRIVE_FOLDER, AIRTABLE_BASE_URL } from '../lib/constants'

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
      {/* Left: Logo + Quick Links */}
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

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1.5 ml-2">
          <a
            href={GOOGLE_DRIVE_FOLDER}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-dark-600 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all text-[11px] font-medium border border-transparent hover:border-blue-500/20"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-6l-2 3H9l-2-3H1" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            Drive
          </a>
          <a
            href={AIRTABLE_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-dark-600 text-gray-400 hover:text-teal-400 hover:bg-teal-500/10 transition-all text-[11px] font-medium border border-transparent hover:border-teal-500/20"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Airtable
          </a>
        </div>
      </div>

      {/* Center: Key Stats */}
      <div className="flex items-center gap-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-accent-green pulse-dot"></div>
            <div className="text-2xl font-bold">{stats.agentsActive}</div>
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Agents Online</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{stats.tasksInQueue}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">In Queue</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-accent-orange">{stats.inReview}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">In Review</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-accent-green">{stats.completed}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Completed</div>
        </div>
        <div className="text-center border-l border-dark-500 pl-8">
          <div className="text-2xl font-bold text-accent-purple">{stats.contentPieces || 0}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Content Pieces</div>
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

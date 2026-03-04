'use client'

import { useState, useEffect } from 'react'
import { GOOGLE_DRIVE_FOLDER, AIRTABLE_BASE_URL, APP_NAME, APP_TAGLINE, COUNCIL_NAME, COUNCIL_ORG, CRON_INTERVAL_MINUTES } from '../lib/constants'

// Roundtable Logo — circular table with nodes representing seats
function RoundtableLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className="roundtable-logo" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring — the table */}
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="2.5" opacity="0.6"/>
      {/* Inner circle */}
      <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
      {/* Seat nodes around the table */}
      <circle cx="32" cy="6" r="4" fill="currentColor" opacity="0.9"/>
      <circle cx="54" cy="17" r="4" fill="currentColor" opacity="0.8"/>
      <circle cx="54" cy="47" r="4" fill="currentColor" opacity="0.7"/>
      <circle cx="32" cy="58" r="4" fill="currentColor" opacity="0.8"/>
      <circle cx="10" cy="47" r="4" fill="currentColor" opacity="0.7"/>
      <circle cx="10" cy="17" r="4" fill="currentColor" opacity="0.9"/>
      {/* Center dot — the focal point */}
      <circle cx="32" cy="32" r="4" fill="currentColor"/>
      {/* Connecting lines from center to seats */}
      <line x1="32" y1="32" x2="32" y2="10" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <line x1="32" y1="32" x2="52" y2="19" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <line x1="32" y1="32" x2="52" y2="45" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <line x1="32" y1="32" x2="32" y2="54" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <line x1="32" y1="32" x2="12" y2="45" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <line x1="32" y1="32" x2="12" y2="19" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function CronCountdown() {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function calc() {
      const now = new Date()
      const next = new Date(now)
      next.setMinutes(CRON_INTERVAL_MINUTES, 0, 0)
      if (next <= now) next.setHours(next.getHours() + 1)
      const diff = Math.max(0, Math.floor((next - now) / 1000))
      const m = Math.floor(diff / 60)
      const s = diff % 60
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-gray-500" title="Time until next auto-run">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span className="font-mono">{remaining}</span>
    </div>
  )
}

export default function StatsHeader({ stats, currentTime, dataSource, lastSync, theme, onToggleTheme, onRunAgents, runningAgents, onOpenSettings }) {
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
    <header className="header-bar border-b border-dark-500 px-5 py-2.5 flex items-center justify-between shrink-0">
      {/* Left: Logo + Council Name + Quick Links */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <RoundtableLogo size={28} />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight">{APP_NAME}</span>
              <span className="text-[9px] text-gray-500 tracking-wider lowercase italic">{APP_TAGLINE}</span>
            </div>
            <span className="text-[10px] text-accent-orange font-medium -mt-0.5">{COUNCIL_NAME} <span className="text-gray-600">/ {COUNCIL_ORG}</span></span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1.5 ml-1">
          <a
            href={GOOGLE_DRIVE_FOLDER}
            target="_blank"
            rel="noopener noreferrer"
            className="header-btn flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-6l-2 3H9l-2-3H1" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            Drive
          </a>
          <a
            href={AIRTABLE_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="header-btn flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      <div className="flex items-center gap-7">
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
        <div className="text-center border-l border-dark-500 pl-7">
          <div className="text-2xl font-bold text-accent-purple">{stats.contentPieces || 0}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Content</div>
        </div>
      </div>

      {/* Right: Run Agents + Theme + Settings + Clock + Status */}
      <div className="flex items-center gap-3">
        {/* Run Agents Button + Countdown */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={onRunAgents}
            disabled={runningAgents}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all ${
              runningAgents
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30 cursor-wait'
                : 'bg-accent-green/10 text-accent-green border border-accent-green/20 hover:bg-accent-green/20 hover:border-accent-green/40'
            }`}
            title="Run all agents on assigned tasks"
          >
            {runningAgents ? (
              <>
                <div className="w-3 h-3 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin"></div>
                Running...
              </>
            ) : (
              <>
                <PlayIcon />
                Run Agents
              </>
            )}
          </button>
          <CronCountdown />
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="header-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          <span className="text-[10px] font-medium uppercase tracking-wider">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="header-btn p-1.5 rounded-lg transition-all"
          title="Settings"
        >
          <SettingsIcon />
        </button>

        <div className="text-right">
          <div className="text-lg font-mono font-bold tracking-wider">{formatTime(currentTime)}</div>
          <div className="text-[10px] text-gray-500 tracking-wider">{formatDate(currentTime)}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 status-badge-container px-3 py-1.5 rounded-md">
            <div className={`w-2 h-2 rounded-full pulse-dot ${dataSource === 'airtable' ? 'bg-accent-green' : dataSource === 'mock' ? 'bg-accent-yellow' : 'bg-gray-500'}`}></div>
            <span className={`text-xs font-semibold ${dataSource === 'airtable' ? 'text-accent-green' : dataSource === 'mock' ? 'text-accent-yellow' : 'text-gray-500'}`}>
              {dataSource === 'airtable' ? 'LIVE' : dataSource === 'mock' ? 'OFFLINE' : '...'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

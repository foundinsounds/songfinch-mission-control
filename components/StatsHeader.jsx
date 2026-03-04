'use client'

import { useState, useEffect } from 'react'
import { GOOGLE_DRIVE_FOLDER, AIRTABLE_BASE_URL, APP_NAME, COUNCIL_NAME, COUNCIL_ORG, CRON_INTERVAL_MINUTES } from '../lib/constants'

function RoundtableLogo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className="roundtable-logo" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="2.5" opacity="0.6"/>
      <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
      <circle cx="32" cy="6" r="4" fill="currentColor" opacity="0.9"/>
      <circle cx="54" cy="17" r="4" fill="currentColor" opacity="0.8"/>
      <circle cx="54" cy="47" r="4" fill="currentColor" opacity="0.7"/>
      <circle cx="32" cy="58" r="4" fill="currentColor" opacity="0.8"/>
      <circle cx="10" cy="47" r="4" fill="currentColor" opacity="0.7"/>
      <circle cx="10" cy="17" r="4" fill="currentColor" opacity="0.9"/>
      <circle cx="32" cy="32" r="4" fill="currentColor"/>
      <line x1="32" y1="32" x2="32" y2="10" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <line x1="32" y1="32" x2="52" y2="19" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <line x1="32" y1="32" x2="52" y2="45" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <line x1="32" y1="32" x2="32" y2="54" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <line x1="32" y1="32" x2="12" y2="45" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <line x1="32" y1="32" x2="12" y2="19" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
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
    <span className="text-[9px] font-mono text-gray-600 tabular-nums">{remaining}</span>
  )
}

export default function StatsHeader({ stats, currentTime, dataSource, lastSync, theme, onToggleTheme, onRunAgents, runningAgents, onOpenSettings }) {
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return (
    <header className="header-bar border-b border-dark-500 px-4 py-1.5 flex items-center justify-between shrink-0">
      {/* Left: Logo + Name */}
      <div className="flex items-center gap-2.5">
        <RoundtableLogo />
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight">{APP_NAME}</span>
          <span className="text-[9px] text-accent-orange font-medium">{COUNCIL_NAME}</span>
        </div>
        <div className="w-px h-4 bg-dark-500 mx-1" />
        <div className="flex items-center gap-1">
          <a href={GOOGLE_DRIVE_FOLDER} target="_blank" rel="noopener noreferrer"
            className="header-btn px-2 py-1 rounded text-[10px] font-medium">Drive</a>
          <a href={AIRTABLE_BASE_URL} target="_blank" rel="noopener noreferrer"
            className="header-btn px-2 py-1 rounded text-[10px] font-medium">Airtable</a>
        </div>
      </div>

      {/* Center: Compact Stats */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-green pulse-dot" />
          <span className="text-sm font-bold">{stats.agentsActive}</span>
          <span className="text-[9px] text-gray-500 uppercase">online</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold">{stats.tasksInQueue}</span>
          <span className="text-[9px] text-gray-500 uppercase">queue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-accent-orange">{stats.inReview}</span>
          <span className="text-[9px] text-gray-500 uppercase">review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-accent-green">{stats.completed}</span>
          <span className="text-[9px] text-gray-500 uppercase">done</span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-dark-500 pl-5">
          <span className="text-sm font-bold text-accent-purple">{stats.contentPieces || 0}</span>
          <span className="text-[9px] text-gray-500 uppercase">content</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Run Agents */}
        <button
          onClick={onRunAgents}
          disabled={runningAgents}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
            runningAgents
              ? 'bg-accent-green/20 text-accent-green border border-accent-green/30 cursor-wait'
              : 'bg-accent-green/10 text-accent-green border border-accent-green/20 hover:bg-accent-green/20 hover:border-accent-green/40'
          }`}
        >
          {runningAgents ? (
            <>
              <div className="w-2.5 h-2.5 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
              Running
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Run
            </>
          )}
        </button>
        <CronCountdown />

        <div className="w-px h-4 bg-dark-500" />

        {/* Theme */}
        <button onClick={onToggleTheme} className="header-btn p-1.5 rounded transition-all" title="Toggle theme">
          {theme === 'dark' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>

        {/* Settings */}
        <button onClick={onOpenSettings} className="header-btn p-1.5 rounded transition-all" title="Settings">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>

        {/* Clock + Status */}
        <div className="flex items-center gap-2 pl-1">
          <span className="text-xs font-mono font-bold tabular-nums">{formatTime(currentTime)}</span>
          <div className={`w-1.5 h-1.5 rounded-full pulse-dot ${dataSource === 'airtable' ? 'bg-accent-green' : dataSource === 'mock' ? 'bg-accent-yellow' : 'bg-gray-500'}`} />
          <span className={`text-[9px] font-semibold ${dataSource === 'airtable' ? 'text-accent-green' : dataSource === 'mock' ? 'text-accent-yellow' : 'text-gray-500'}`}>
            {dataSource === 'airtable' ? 'LIVE' : dataSource === 'mock' ? 'OFFLINE' : '...'}
          </span>
        </div>
      </div>
    </header>
  )
}

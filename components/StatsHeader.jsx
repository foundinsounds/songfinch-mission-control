'use client'

import { useState, useEffect, useCallback } from 'react'
import { GOOGLE_DRIVE_FOLDER, AIRTABLE_BASE_URL, APP_NAME, COUNCIL_NAME, COUNCIL_ORG, CRON_INTERVAL_MINUTES } from '../lib/constants'
import { useVisibilityPolling } from '../lib/useVisibilityPolling'
import MiniSparkline from './MiniSparkline'

function RoundtableLogo({ size = 22 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 64 64" fill="none" className="roundtable-logo" xmlns="http://www.w3.org/2000/svg">
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

  // Visibility-aware: pauses the 1 s tick when tab is hidden
  useVisibilityPolling(useCallback(() => {
    const now = new Date()
    const next = new Date(now)
    next.setMinutes(CRON_INTERVAL_MINUTES, 0, 0)
    if (next <= now) next.setHours(next.getHours() + 1)
    const diff = Math.max(0, Math.floor((next - now) / 1000))
    const m = Math.floor(diff / 60)
    const s = diff % 60
    setRemaining(`${m}:${s.toString().padStart(2, '0')}`)
  }, []), 1_000)

  return (
    <span className="text-[9px] font-mono text-gray-600 tabular-nums">{remaining}</span>
  )
}

function LastRunIndicator({ lastRunTime }) {
  const [display, setDisplay] = useState('')

  const update = useCallback(() => {
    if (!lastRunTime) { setDisplay('never'); return }
    const diff = Date.now() - new Date(lastRunTime).getTime()
    const secs = Math.floor(diff / 1000)
    const mins = Math.floor(secs / 60)
    const hrs = Math.floor(mins / 60)

    if (secs < 60) setDisplay('just now')
    else if (mins < 60) setDisplay(`${mins}m ago`)
    else if (hrs < 24) setDisplay(`${hrs}h ago`)
    else setDisplay(`${Math.floor(hrs / 24)}d ago`)
  }, [lastRunTime])

  // Immediate update when lastRunTime changes
  useEffect(() => { update() }, [update])
  // Visibility-aware periodic refresh (skip initial — useEffect above handles it)
  useVisibilityPolling(update, 10_000, { immediate: false })

  const isRecent = lastRunTime && (Date.now() - new Date(lastRunTime).getTime()) < 120000 // < 2min

  return (
    <div className="flex items-center gap-1" title={lastRunTime ? `Last run: ${new Date(lastRunTime).toLocaleString()}` : 'No runs yet'}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={isRecent ? 'text-accent-green' : 'text-gray-600'}>
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span className={`text-[9px] font-mono tabular-nums ${isRecent ? 'text-accent-green' : 'text-gray-600'}`}>
        {display}
      </span>
    </div>
  )
}

/**
 * LastSyncBadge — shows a live "Updated Xm ago" indicator with a manual refresh button.
 */
function LastSyncBadge({ lastSync, isSyncing, onRefresh }) {
  const [display, setDisplay] = useState('')

  const update = useCallback(() => {
    if (!lastSync) { setDisplay('--'); return }
    const diff = Date.now() - new Date(lastSync).getTime()
    const secs = Math.floor(diff / 1000)
    const mins = Math.floor(secs / 60)
    const hrs = Math.floor(mins / 60)

    if (secs < 10) setDisplay('just now')
    else if (secs < 60) setDisplay(`${secs}s ago`)
    else if (mins < 60) setDisplay(`${mins}m ago`)
    else if (hrs < 24) setDisplay(`${hrs}h ago`)
    else setDisplay(`${Math.floor(hrs / 24)}d ago`)
  }, [lastSync])

  // Immediate update when lastSync changes
  useEffect(() => { update() }, [update])
  // Visibility-aware periodic refresh
  useVisibilityPolling(update, 5_000, { immediate: false })

  const isFresh = lastSync && (Date.now() - new Date(lastSync).getTime()) < 60000

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[9px] font-mono tabular-nums ${isFresh ? 'text-gray-500' : 'text-gray-600'}`} title={lastSync ? `Last updated: ${new Date(lastSync).toLocaleString()}` : 'Not synced yet'}>
        {display}
      </span>
      <button
        onClick={onRefresh}
        disabled={isSyncing}
        className="p-0.5 rounded hover:bg-dark-600 transition-colors disabled:opacity-30"
        title="Refresh data now"
        aria-label={isSyncing ? 'Syncing data' : 'Refresh data now'}
      >
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`${isSyncing ? 'animate-spin text-accent-orange' : 'text-gray-500 hover:text-gray-300'}`}>
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </button>
    </div>
  )
}

/**
 * ProgressRing — SVG donut chart showing task completion %.
 * Uses strokeDasharray/offset for the arc.  Animates smoothly via CSS transition.
 */
function ProgressRing({ completed, total, size = 28, strokeWidth = 3 }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)

  // Color coding: green 70%+, orange 30-69%, red <30%
  const color = pct >= 70 ? '#22c55e' : pct >= 30 ? '#f97316' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center" title={`${completed}/${total} tasks done (${pct}%)`} role="img" aria-label={`Task completion: ${pct}%, ${completed} of ${total} done`}>
      <svg aria-hidden="true" width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-dark-500"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
      </svg>
      <span className="absolute text-[7px] font-bold tabular-nums" style={{ color }}>
        {pct}
      </span>
    </div>
  )
}

/**
 * StatsHeader — top bar with stats, sync state, actions, and layout controls.
 *
 * Props are grouped into five logical buckets to keep the callsite scannable:
 *   data     — display data (stats, sparklines, currentTime, dataSource, lastSync, lastRunTime)
 *   sync     — data-refresh state (isSyncing, onRefresh)
 *   actions  — primary CTA buttons (run agents, plan campaign)
 *   panels   — callbacks that open modal panels
 *   ui       — theme, layout toggles, focus mode
 *   slots    — injected render slots for notification, pipeline badge, productivity score
 */
export default function StatsHeader({ data = {}, sync = {}, actions = {}, panels = {}, ui = {}, slots = {} }) {
  // Destructure grouped props — keeps the JSX below identical to before
  const { stats = {}, sparklines, currentTime, dataSource, lastSync, lastRunTime } = data
  const { isSyncing, onRefresh } = sync
  const { onRunAgents, runningAgents, onPlanCampaign, planningCampaign } = actions
  const { onOpenSettings, onOpenMetrics, onOpenComparison, onOpenCalendarHeatmap, onOpenTimeline } = panels
  const { theme, onToggleTheme, focusModeActive, onToggleFocusMode, onToggleSidebar, onToggleFeed } = ui
  const { notification: notificationSlot, pipeline: pipelineSlot, productivity: productivitySlot } = slots

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return (
    <header className="header-bar border-b border-dark-500 px-2 sm:px-4 py-1.5 flex items-center justify-between shrink-0 gap-2">
      {/* Left: Mobile hamburger + Logo + Name */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        {/* Mobile hamburger */}
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} className="md:hidden header-btn p-1.5 rounded" title="Toggle agents sidebar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <RoundtableLogo />
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold tracking-tight truncate">{APP_NAME}</span>
          <span className="text-[9px] text-accent-orange font-medium hidden sm:inline">{COUNCIL_NAME}</span>
        </div>
        <div className="w-px h-4 bg-dark-500 mx-1 hidden lg:block" />
        <div className="hidden lg:flex items-center gap-1">
          <a href={GOOGLE_DRIVE_FOLDER} target="_blank" rel="noopener noreferrer"
            className="header-btn px-2 py-1 rounded text-[10px] font-medium">Drive</a>
          <a href={AIRTABLE_BASE_URL} target="_blank" rel="noopener noreferrer"
            className="header-btn px-2 py-1 rounded text-[10px] font-medium">Airtable</a>
        </div>
      </div>

      {/* Center: Compact Stats with Sparklines */}
      <div className="hidden sm:flex items-center gap-3 lg:gap-5">
        <div className="flex items-center gap-1.5 animate-stat-count">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-green pulse-dot" />
          <span className="text-sm font-bold">{stats.agentsActive}</span>
          <span className="text-[9px] text-gray-500 uppercase">online</span>
        </div>
        <div className="flex items-center gap-1.5 animate-stat-count">
          <span className="text-sm font-bold">{stats.tasksInQueue}</span>
          <span className="text-[9px] text-gray-500 uppercase">queue</span>
          {sparklines?.queue && <MiniSparkline data={sparklines.queue} color="#94a3b8" width={40} height={14} />}
        </div>
        <div className="flex items-center gap-1.5 animate-stat-count">
          <span className="text-sm font-bold text-accent-orange">{stats.inReview}</span>
          <span className="text-[9px] text-gray-500 uppercase">review</span>
          {sparklines?.review && <MiniSparkline data={sparklines.review} color="#f97316" width={40} height={14} filled />}
        </div>
        <div className="flex items-center gap-1.5 animate-stat-count">
          <span className="text-sm font-bold text-accent-green">{stats.completed}</span>
          <span className="text-[9px] text-gray-500 uppercase">done</span>
          {sparklines?.done && <MiniSparkline data={sparklines.done} color="#22c55e" width={40} height={14} filled />}
        </div>
        <div className="hidden xl:flex items-center gap-1.5 border-l border-dark-500 pl-5 animate-stat-count">
          <span className="text-sm font-bold text-accent-purple">{stats.contentPieces || 0}</span>
          <span className="text-[9px] text-gray-500 uppercase">content</span>
          {sparklines?.content && <MiniSparkline data={sparklines.content} color="#a855f7" width={40} height={14} />}
        </div>
        {/* Progress Ring */}
        <div className="hidden lg:flex items-center gap-1.5 border-l border-dark-500 pl-5">
          <ProgressRing completed={stats.completed} total={stats.tasksTotal} />
        </div>
        {/* Last Updated + Refresh */}
        <div className="hidden lg:flex items-center gap-1 border-l border-dark-500 pl-4">
          <LastSyncBadge lastSync={lastSync} isSyncing={isSyncing} onRefresh={onRefresh} />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
        {/* Plan Campaign — hidden on small screens */}
        {onPlanCampaign && (
          <button
            onClick={onPlanCampaign}
            disabled={planningCampaign}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
              planningCampaign
                ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30 cursor-wait'
                : 'bg-accent-purple/10 text-accent-purple border border-accent-purple/20 hover:bg-accent-purple/20 hover:border-accent-purple/40'
            }`}
          >
            {planningCampaign ? (
              <>
                <div className="w-2.5 h-2.5 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
                Planning
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Plan
              </>
            )}
          </button>
        )}
        <div className="hidden lg:flex items-center gap-1.5">
          <CronCountdown />
          <span className="text-[8px] text-gray-700">next</span>
        </div>
        <div className="hidden lg:block">
          <LastRunIndicator lastRunTime={lastRunTime} />
        </div>

        {/* Productivity Score Widget */}
        {productivitySlot && <div className="hidden lg:block">{productivitySlot}</div>}

        <div className="w-px h-4 bg-dark-500 hidden sm:block" />

        {/* Theme */}
        <button onClick={onToggleTheme} className="header-btn p-1.5 rounded transition-all" title="Toggle theme" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          {theme === 'dark' ? (
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>

        {/* Agent Metrics */}
        {onOpenMetrics && (
          <button onClick={onOpenMetrics} className="header-btn p-1.5 rounded transition-all" title="Agent Metrics (M)" aria-label="Agent metrics">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>
          </button>
        )}

        {/* Agent Comparison */}
        {onOpenComparison && (
          <button onClick={onOpenComparison} className="header-btn p-1.5 rounded transition-all" title="Agent Comparison (C)" aria-label="Agent comparison">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M21 3l-7 7"/><path d="M3 3l7 7"/><path d="M16 21h5v-5"/><path d="M8 21H3v-5"/><path d="M21 21l-7-7"/><path d="M3 21l7-7"/></svg>
          </button>
        )}
        {onOpenCalendarHeatmap && (
          <button onClick={onOpenCalendarHeatmap} className="header-btn p-1.5 rounded transition-all" title="Content Calendar Heatmap (G)" aria-label="Content calendar heatmap">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><rect x="7" y="13" width="3" height="3" rx="0.5" opacity="0.3" /><rect x="14" y="13" width="3" height="3" rx="0.5" opacity="0.7" /><rect x="7" y="17" width="3" height="3" rx="0.5" opacity="0.5" /></svg>
          </button>
        )}

        {/* Agent Timeline */}
        {onOpenTimeline && (
          <button onClick={onOpenTimeline} className="header-btn p-1.5 rounded transition-all" title="Agent Timeline (Y)" aria-label="Agent timeline">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="7" cy="12" r="2"/><circle cx="14" cy="12" r="2"/><circle cx="20" cy="12" r="1.5"/><line x1="7" y1="6" x2="7" y2="10"/><line x1="14" y1="6" x2="14" y2="10"/></svg>
          </button>
        )}

        {/* Focus Mode */}
        {onToggleFocusMode && (
          <button
            onClick={onToggleFocusMode}
            className={`header-btn p-1.5 rounded transition-all ${focusModeActive ? 'text-accent-green bg-accent-green/10' : ''}`}
            title={`Focus Mode (F) ${focusModeActive ? '— Active' : ''}`}
            aria-label={focusModeActive ? 'Disable focus mode' : 'Enable focus mode'}
            aria-pressed={focusModeActive}
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
          </button>
        )}

        {/* Settings */}
        <button onClick={onOpenSettings} className="header-btn p-1.5 rounded transition-all" title="Settings" aria-label="Open settings">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>

        {/* Notification Center */}
        {notificationSlot}

        {/* Pipeline Health Badge */}
        {pipelineSlot && <div className="hidden sm:block">{pipelineSlot}</div>}

        {/* Clock + Status */}
        <div className="hidden sm:flex items-center gap-2 pl-1">
          <span className="text-xs font-mono font-bold tabular-nums">{formatTime(currentTime)}</span>
          <div className={`w-1.5 h-1.5 rounded-full pulse-dot ${dataSource === 'airtable' ? 'bg-accent-green' : dataSource === 'mock' ? 'bg-accent-yellow' : 'bg-gray-500'}`} />
          <span className={`text-[9px] font-semibold ${dataSource === 'airtable' ? 'text-accent-green' : dataSource === 'mock' ? 'text-accent-yellow' : 'text-gray-500'}`}>
            {dataSource === 'airtable' ? 'LIVE' : dataSource === 'mock' ? 'OFFLINE' : '...'}
          </span>
        </div>

        {/* Mobile data status dot only */}
        <div className="sm:hidden flex items-center" aria-label={dataSource === 'airtable' ? 'Connected to Airtable' : dataSource === 'mock' ? 'Using offline data' : 'Connecting'} role="status">
          <div className={`w-2 h-2 rounded-full pulse-dot ${dataSource === 'airtable' ? 'bg-accent-green' : dataSource === 'mock' ? 'bg-accent-yellow' : 'bg-gray-500'}`} />
        </div>

        {/* Mobile feed toggle */}
        {onToggleFeed && (
          <button onClick={onToggleFeed} className="md:hidden header-btn p-1.5 rounded" title="Toggle activity feed" aria-label="Toggle activity feed">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}

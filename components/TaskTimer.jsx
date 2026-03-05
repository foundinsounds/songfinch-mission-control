'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'roundtable-timers'

function getTimers() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveTimers(timers) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers))
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

function getTimerState(taskId) {
  const timers = getTimers()
  return timers[taskId] || { elapsed: 0, running: false, startedAt: null }
}

function setTimerState(taskId, state) {
  const timers = getTimers()
  timers[taskId] = state
  saveTimers(timers)
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':')
}

function PlayIcon({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}

function PauseIcon({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="4" y="3" width="6" height="18" rx="1" />
      <rect x="14" y="3" width="6" height="18" rx="1" />
    </svg>
  )
}

function StopIcon({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  )
}

export default function TaskTimer({ taskId }) {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)
  const startedAtRef = useRef(null)
  const baseElapsedRef = useRef(0)

  // Initialize from localStorage
  useEffect(() => {
    if (!taskId) return
    const state = getTimerState(taskId)
    baseElapsedRef.current = state.elapsed || 0

    if (state.running && state.startedAt) {
      // Timer was left running -- compute how much time has passed since
      const now = Date.now()
      const additionalMs = now - state.startedAt
      const totalElapsed = baseElapsedRef.current + additionalMs
      setElapsed(totalElapsed)
      setRunning(true)
      startedAtRef.current = state.startedAt
    } else {
      setElapsed(state.elapsed || 0)
      setRunning(false)
      startedAtRef.current = null
    }
  }, [taskId])

  // Tick interval when running
  useEffect(() => {
    if (running && startedAtRef.current) {
      intervalRef.current = setInterval(() => {
        const now = Date.now()
        const additionalMs = now - startedAtRef.current
        setElapsed(baseElapsedRef.current + additionalMs)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [running])

  const handleStart = useCallback(() => {
    if (!taskId) return
    const now = Date.now()
    startedAtRef.current = now
    // baseElapsedRef already holds the accumulated time
    setRunning(true)
    setTimerState(taskId, {
      elapsed: baseElapsedRef.current,
      running: true,
      startedAt: now,
    })
  }, [taskId])

  const handlePause = useCallback(() => {
    if (!taskId) return
    // Calculate total elapsed and persist
    const now = Date.now()
    const additionalMs = startedAtRef.current ? now - startedAtRef.current : 0
    const totalElapsed = baseElapsedRef.current + additionalMs
    baseElapsedRef.current = totalElapsed
    startedAtRef.current = null
    setRunning(false)
    setElapsed(totalElapsed)
    setTimerState(taskId, {
      elapsed: totalElapsed,
      running: false,
      startedAt: null,
    })
  }, [taskId])

  const handleStop = useCallback(() => {
    if (!taskId) return
    // Reset everything
    baseElapsedRef.current = 0
    startedAtRef.current = null
    setRunning(false)
    setElapsed(0)
    setTimerState(taskId, {
      elapsed: 0,
      running: false,
      startedAt: null,
    })
  }, [taskId])

  const handleToggle = useCallback(() => {
    if (running) {
      handlePause()
    } else {
      handleStart()
    }
  }, [running, handlePause, handleStart])

  if (!taskId) return null

  const hasTime = elapsed > 0 || running

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-mono
        transition-all duration-200 select-none
        ${running
          ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
          : hasTime
            ? 'bg-dark-600 border border-dark-500 text-gray-400'
            : 'bg-dark-600 border border-dark-500 text-gray-500'
        }
      `}
    >
      {/* Play/Pause button */}
      <button
        onClick={handleToggle}
        className={`
          flex items-center justify-center w-4 h-4 rounded-full transition-colors
          ${running
            ? 'text-orange-400 hover:text-orange-300'
            : 'text-gray-400 hover:text-gray-200'
          }
        `}
        title={running ? 'Pause timer' : 'Start timer'}
      >
        {running ? <PauseIcon size={8} /> : <PlayIcon size={8} />}
      </button>

      {/* Pulsing dot when running */}
      {running && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-400" />
        </span>
      )}

      {/* Time display */}
      <span className={`tabular-nums ${running ? 'text-orange-300' : 'text-gray-400'}`}>
        {formatTime(elapsed)}
      </span>

      {/* Stop/reset button -- only show when there is accumulated time */}
      {hasTime && (
        <button
          onClick={handleStop}
          className="flex items-center justify-center w-4 h-4 rounded-full text-gray-500 hover:text-red-400 transition-colors"
          title="Stop and reset timer"
        >
          <StopIcon size={7} />
        </button>
      )}
    </div>
  )
}

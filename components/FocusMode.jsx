'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * FocusMode — Zen overlay that dims distractions around the main content area.
 *
 * - Adds 'focus-mode-active' to document.body so globals.css can hide sidebar/nav
 * - Floating pill with live timer, pulsing green dot, and "Exit" button
 * - Fade-in/out over 300ms, closes on Escape
 * - The overlay itself is transparent; the body class drives the actual hiding
 *
 * Props:
 *   isActive — whether focus mode is currently on
 *   onToggle — callback to flip the active state
 */
export default function FocusMode({ isActive, onToggle }) {
  const [visible, setVisible] = useState(false)
  const [elapsed, setElapsed] = useState('00:00')
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  // ---------- body class + entrance / exit ----------
  useEffect(() => {
    if (isActive) {
      document.body.classList.add('focus-mode-active')
      setVisible(true)
      startRef.current = Date.now()
    } else {
      document.body.classList.remove('focus-mode-active')
      // let the fade-out finish before unmounting
      const id = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(id)
    }

    return () => {
      document.body.classList.remove('focus-mode-active')
    }
  }, [isActive])

  // ---------- timer ----------
  useEffect(() => {
    if (isActive) {
      setElapsed('00:00')
      startRef.current = Date.now()

      intervalRef.current = setInterval(() => {
        const diff = Math.floor((Date.now() - startRef.current) / 1000)
        const m = String(Math.floor(diff / 60)).padStart(2, '0')
        const s = String(diff % 60).padStart(2, '0')
        setElapsed(`${m}:${s}`)
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [isActive])

  // ---------- escape key ----------
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && isActive) {
        onToggle()
      }
    },
    [isActive, onToggle]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ---------- render ----------
  if (!visible && !isActive) return null

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-none transition-opacity duration-300 ${
        isActive ? 'opacity-100' : 'opacity-0'
      }`}
      aria-live="polite"
    >
      {/* floating pill — top-right */}
      <div
        className="pointer-events-auto absolute top-4 right-4 flex items-center gap-2 bg-dark-800/90 backdrop-blur-sm border border-dark-500 rounded-full px-3 py-1.5"
      >
        {/* pulsing green dot */}
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green" />
        </span>

        <span className="text-[10px] text-gray-400 font-medium select-none">
          Focus Mode
        </span>

        {/* timer */}
        <span className="text-[10px] text-gray-500 font-mono tabular-nums select-none">
          {elapsed}
        </span>

        {/* divider */}
        <span className="w-px h-3 bg-dark-500" />

        {/* keyboard hint */}
        <span className="text-[8px] text-gray-600 select-none hidden sm:inline">
          Esc to exit
        </span>

        {/* exit button */}
        <button
          onClick={onToggle}
          className="text-[10px] text-accent-orange/70 hover:text-accent-orange transition-colors duration-150 font-medium"
        >
          Exit
        </button>
      </div>
    </div>
  )
}

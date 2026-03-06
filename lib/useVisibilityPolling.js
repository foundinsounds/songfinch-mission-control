'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * useVisibilityPolling — visibility-aware polling hook.
 *
 * Calls `fn` immediately, then on `interval` ms. Pauses when the browser tab
 * is hidden and resumes (with an immediate call) when the tab regains focus.
 *
 * This saves API calls when the user isn't looking at the page — particularly
 * valuable for dashboard components that poll heavy endpoints.
 *
 * @param {() => void} fn         — the function to call (should be stable / useCallback'd)
 * @param {number}     interval   — polling interval in ms (0 to disable polling)
 * @param {Object}     [options]
 * @param {boolean}    [options.enabled=true]  — master switch to disable polling entirely
 * @param {boolean}    [options.immediate=true] — call fn immediately on mount
 *
 * @example
 *   useVisibilityPolling(fetchStats, 30_000)
 *   useVisibilityPolling(fetchIntel, 60_000, { enabled: tab === 'intelligence' })
 */
export function useVisibilityPolling(fn, interval, { enabled = true, immediate = true } = {}) {
  const timerRef = useRef(null)
  const fnRef = useRef(fn)

  // Keep fn ref current without re-triggering the effect
  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  const start = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (interval > 0) {
      timerRef.current = setInterval(() => fnRef.current(), interval)
    }
  }, [interval])

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      stop()
      return
    }

    // Initial call
    if (immediate) fnRef.current()
    start()

    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        stop()
      } else {
        // Refresh immediately on tab focus, then resume polling
        fnRef.current()
        start()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, start, stop, immediate])
}

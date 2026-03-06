'use client'

import { useState, useCallback, useEffect } from 'react'
import { AGENTS as FALLBACK_AGENTS } from './agents'
import { checkEscalations } from './escalation'

/**
 * useDataFetching — handles Airtable data fetching, visibility-aware polling,
 * settings-driven auto-refresh, and agent auto-run scheduling.
 *
 * Extracted from page.js to isolate all network/polling concerns.
 *
 * Features:
 *  - Skips polling when tab is hidden (saves API calls)
 *  - Resumes + immediate fetch when tab regains focus
 *  - Configurable polling interval via autoRefreshInterval
 *  - Auto-run agents on a separate interval from localStorage settings
 *  - Graceful fallback to mock data on network failure
 */
export function useDataFetching({
  setAgents,
  setTasks,
  setActivity,
  setDataSource,
  autoRefreshInterval,
  settingsRev,
}) {
  const [lastSync, setLastSync] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Fetch live data from Airtable
  const fetchData = useCallback(async () => {
    // Skip polling when tab is hidden to save API calls
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    setIsSyncing(true)
    try {
      const res = await fetch('/api/data')
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      if (data.agents && data.agents.length > 0) {
        // Merge: Airtable agents + any fallback agents not in Airtable
        const airtableNames = new Set(data.agents.map(a => a.name))
        const missing = FALLBACK_AGENTS.filter(a => !airtableNames.has(a.name))
        setAgents([...data.agents, ...missing])
      }

      // Always accept the Airtable tasks — even if empty.
      // Only fall back to mock data on network / API errors (catch block).
      if (data.tasks) {
        if (data.tasks.length > 0) {
          setTasks(checkEscalations(data.tasks))
          setDataSource('airtable')
        } else {
          setTasks([])
          setDataSource('airtable-empty')
        }
      }

      if (data.activity && data.activity.length > 0) {
        setActivity(data.activity)
      }

      setLastSync(new Date())
    } catch (err) {
      console.warn('Airtable fetch failed, using mock data:', err.message)
      setDataSource('mock')
    } finally {
      setIsSyncing(false)
    }
  }, [setAgents, setTasks, setActivity, setDataSource])

  // Read settings from localStorage
  const getSettings = useCallback(() => {
    if (typeof window === 'undefined') return { autoRunAgents: true, runInterval: 15, pollInterval: 10 }
    try {
      const saved = localStorage.getItem('roundtable-settings')
      if (saved) return { autoRunAgents: true, runInterval: 15, pollInterval: 10, ...JSON.parse(saved) }
    } catch {}
    return { autoRunAgents: true, runInterval: 15, pollInterval: 10 }
  }, [])

  // Initial fetch + visibility-aware auto-polling
  useEffect(() => {
    fetchData()

    let poller = null

    function startPolling() {
      stopPolling()
      if (autoRefreshInterval > 0) {
        poller = setInterval(fetchData, autoRefreshInterval)
      }
    }

    function stopPolling() {
      if (poller) {
        clearInterval(poller)
        poller = null
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stopPolling()
      } else {
        // Refresh immediately when tab becomes visible, then resume polling
        fetchData()
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchData, autoRefreshInterval])

  // Auto-run agents on configured interval
  useEffect(() => {
    function checkAndRun() {
      const settings = getSettings()
      if (!settings.autoRunAgents) return

      // Run agents via the dashboard trigger proxy (injects CRON_SECRET server-side)
      fetch('/api/trigger-agents')
        .then(res => res.json())
        .then(() => {
          setTimeout(fetchData, 2000)
        })
        .catch(err => console.error('[Roundtable] Auto-run failed:', err))
    }

    const settings = getSettings()
    if (!settings.autoRunAgents) return

    // Run immediately on enable, then on interval
    checkAndRun()
    const intervalMs = (settings.runInterval || 60) * 60 * 1000
    const runner = setInterval(checkAndRun, intervalMs)
    return () => clearInterval(runner)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSettings, fetchData, settingsRev])

  return { fetchData, getSettings, lastSync, isSyncing }
}

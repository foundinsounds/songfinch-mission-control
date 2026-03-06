'use client'

import { useState, useCallback } from 'react'
import { useVisibilityPolling } from '../lib/useVisibilityPolling'

// Service metadata: emoji, description, docs link
const SERVICE_META = {
  airtable: {
    emoji: '\uD83D\uDDC4\uFE0F',
    description: 'Task & content database',
    docsUrl: 'https://airtable.com',
  },
  ai: {
    emoji: '\uD83E\uDDE0',
    description: 'Text generation engine',
    docsUrl: null,
  },
  dalle: {
    emoji: '\uD83C\uDFA8',
    description: 'Image generation (OpenAI)',
    docsUrl: 'https://platform.openai.com/docs/guides/images',
  },
  ltx: {
    emoji: '\uD83C\uDFAC',
    description: 'Video generation (Hugging Face)',
    docsUrl: 'https://huggingface.co/Lightricks/LTX-Video',
  },
  cron: {
    emoji: '\u23F0',
    description: 'Automated agent runner',
    docsUrl: null,
  },
  figma: {
    emoji: '\uD83C\uDFA8',
    description: 'Design integration',
    docsUrl: 'https://www.figma.com',
  },
  slack: {
    emoji: '\uD83D\uDCAC',
    description: 'Notifications & alerts',
    docsUrl: 'https://api.slack.com',
  },
}

function StatusDot({ status }) {
  const colorMap = {
    connected: 'bg-green-500',
    disconnected: 'bg-red-500',
    error: 'bg-red-500',
    unknown: 'bg-yellow-500',
  }
  const pulseMap = {
    connected: 'bg-green-500/40',
    error: 'bg-red-500/40',
  }
  const color = colorMap[status] || 'bg-gray-500'
  const pulse = pulseMap[status]

  return (
    <span className="relative flex h-2.5 w-2.5">
      {pulse && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pulse} opacity-75`} />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  )
}

function StatusBadge({ status }) {
  const styles = {
    connected: 'bg-green-500/10 text-green-400 border-green-500/20',
    disconnected: 'bg-red-500/10 text-red-400 border-red-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    unknown: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  }
  const labels = {
    connected: 'Connected',
    disconnected: 'Not configured',
    error: 'Error',
    unknown: 'Unknown',
  }
  const cls = styles[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  const label = labels[status] || status

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border ${cls}`}>
      <StatusDot status={status} />
      {label}
    </span>
  )
}

function ServiceCard({ serviceKey, service, meta, onRefresh, refreshing }) {
  const docsUrl = meta?.docsUrl
  const latency = service?.latencyMs

  return (
    <div className={`
      rounded-xl border p-4 transition-all duration-200 group
      ${service?.status === 'connected'
        ? 'bg-dark-700/50 border-dark-500 hover:border-green-500/30 hover:bg-dark-700/70'
        : service?.status === 'error'
          ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
          : 'bg-dark-700/30 border-dark-600 hover:border-dark-400'
      }
    `}>
      {/* Top row: Emoji + Name + Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-dark-600 border border-dark-500 flex items-center justify-center text-lg shrink-0 group-hover:border-dark-400 transition-colors">
            {meta?.emoji || '\u2699\uFE0F'}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-200">{service?.name || serviceKey}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{meta?.description || ''}</div>
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className="mb-3">
        <StatusBadge status={service?.status || 'unknown'} />
      </div>

      {/* Extra info */}
      <div className="space-y-1.5 mb-3 min-h-[32px]">
        {/* AI provider info */}
        {serviceKey === 'ai' && service?.provider && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 uppercase">Provider:</span>
            <span className="text-[10px] text-gray-300 font-medium">{service.provider}</span>
          </div>
        )}
        {serviceKey === 'ai' && service?.providers && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(service.providers).map(([key, active]) => (
              <span key={key} className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                active ? 'bg-green-500/10 text-green-400' : 'bg-dark-600 text-gray-600'
              }`}>
                {key}
              </span>
            ))}
          </div>
        )}

        {/* Airtable latency */}
        {serviceKey === 'airtable' && latency != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 uppercase">Latency:</span>
            <span className={`text-[10px] font-mono font-medium ${
              latency < 500 ? 'text-green-400' : latency < 2000 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {latency}ms
            </span>
          </div>
        )}

        {/* Airtable record count */}
        {serviceKey === 'airtable' && service?.recordCount != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 uppercase">Records:</span>
            <span className="text-[10px] text-gray-300 font-medium">{service.recordCount}</span>
          </div>
        )}

        {/* Error message */}
        {service?.error && (
          <div className="text-[10px] text-red-400 bg-red-500/5 px-2 py-1 rounded border border-red-500/10 truncate" title={service.error}>
            {service.error}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-2 border-t border-dark-600">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
          title="Refresh status"
        >
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className={refreshing ? 'animate-spin' : ''}
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {refreshing ? 'Checking...' : 'Recheck'}
        </button>
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
          >
            Docs
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>
    </div>
  )
}

function OverallHealthBar({ connectedCount, totalCount, status }) {
  const pct = totalCount > 0 ? Math.round((connectedCount / totalCount) * 100) : 0
  const color = status === 'healthy'
    ? '#22c55e'
    : status === 'degraded'
      ? '#eab308'
      : '#ef4444'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-mono font-bold tabular-nums shrink-0" style={{ color }}>
        {connectedCount}/{totalCount}
      </span>
    </div>
  )
}

export default function PipelineHealth() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState(null)

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const res = await fetch('/api/health/pipeline', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastChecked(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Visibility-aware polling — pauses when tab is hidden, resumes on focus
  useVisibilityPolling(useCallback(() => fetchHealth(true), [fetchHealth]), 60_000)

  const formatTimestamp = (date) => {
    if (!date) return 'never'
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  // Loading skeleton
  if (loading && !data) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-500 shrink-0 bg-dark-800/50">
          <div className="h-4 w-40 bg-dark-600 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-dark-600 p-4 bg-dark-700/30">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-dark-600 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-20 bg-dark-600 rounded animate-pulse" />
                    <div className="h-2 w-28 bg-dark-600 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-5 w-24 bg-dark-600 rounded-full animate-pulse mb-3" />
                <div className="h-8" />
                <div className="h-px bg-dark-600 mt-2 mb-2" />
                <div className="h-3 w-16 bg-dark-600 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const services = data?.services || {}
  const serviceKeys = Object.keys(SERVICE_META)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 shrink-0 bg-dark-800/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-200">Pipeline Health</h2>
            {data?.status && (
              <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                data.status === 'healthy'
                  ? 'bg-green-500/10 text-green-400'
                  : data.status === 'degraded'
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-red-500/10 text-red-400'
              }`}>
                {data.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastChecked && (
              <span className="text-[9px] text-gray-600 font-mono tabular-nums">
                checked {formatTimestamp(lastChecked)}
              </span>
            )}
            <button
              onClick={() => fetchHealth(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-200 disabled:opacity-50"
            >
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                className={refreshing ? 'animate-spin' : ''}
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {refreshing ? 'Refreshing' : 'Refresh All'}
            </button>
          </div>
        </div>
        {data && (
          <OverallHealthBar
            connectedCount={data.connectedCount || 0}
            totalCount={data.totalCount || 0}
            status={data.status}
          />
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          Failed to fetch pipeline health: {error}
        </div>
      )}

      {/* Service grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {serviceKeys.map((key) => (
            <ServiceCard
              key={key}
              serviceKey={key}
              service={services[key]}
              meta={SERVICE_META[key]}
              onRefresh={() => fetchHealth(true)}
              refreshing={refreshing}
            />
          ))}
        </div>

        {/* Footer metadata */}
        {data && (
          <div className="mt-4 pt-3 border-t border-dark-600 flex items-center justify-between text-[9px] text-gray-600">
            <span>
              {data.connectedCount}/{data.totalCount} services connected
            </span>
            <span className="font-mono tabular-nums">
              Check took {data.checkDurationMs || '?'}ms
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

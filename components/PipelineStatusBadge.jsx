'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const STATUS_CONFIG = {
  healthy:  { dot: 'bg-accent-green', label: 'Pipeline Healthy',  textClass: 'text-accent-green' },
  degraded: { dot: 'bg-accent-orange', label: 'Pipeline Degraded', textClass: 'text-accent-orange' },
  down:     { dot: 'bg-accent-red',    label: 'Pipeline Down',     textClass: 'text-accent-red' },
}

const SERVICE_STATUS_DOT = {
  connected:      'bg-accent-green',
  disconnected:   'bg-accent-red',
  error:          'bg-accent-red',
  not_configured: 'bg-dark-400',
  unknown:        'bg-gray-600',
}

const CORE_SERVICES = new Set(['airtable', 'ai', 'dalle', 'cron'])

export default function PipelineStatusBadge({ pollInterval = 30000 }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/health/pipeline')
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount + poll
  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, pollInterval)
    return () => clearInterval(id)
  }, [fetchStatus, pollInterval])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Derive display values
  const status = data?.status
  const config = STATUS_CONFIG[status]
  const coreConnected = data?.coreConnected ?? 0
  const coreTotal = data?.coreTotal ?? 0
  const services = data?.services ?? {}

  let dotClass = 'bg-gray-500'
  let labelText = 'Checking...'
  let labelClass = 'text-gray-500'

  if (!loading && config) {
    dotClass = config.dot
    labelText = status === 'healthy'
      ? `${coreConnected}/${coreTotal} Core`
      : status === 'degraded'
        ? `Degraded (${coreConnected}/${coreTotal})`
        : config.label.replace('Pipeline ', '')
    labelClass = config.textClass
  }

  // Split services into core and optional for grouped display
  const coreEntries = Object.entries(services).filter(([k]) => CORE_SERVICES.has(k))
  const optionalEntries = Object.entries(services).filter(([k]) => !CORE_SERVICES.has(k))

  return (
    <div className="relative" ref={ref}>
      {/* Badge pill */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-dark-700 border border-dark-500 hover:border-dark-600 transition-colors cursor-pointer select-none"
        title="Pipeline health"
      >
        <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${dotClass}`} />
        <span className={`text-[9px] font-semibold uppercase tracking-wide ${labelClass}`}>
          {labelText}
        </span>
      </button>

      {/* Dropdown popover */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-lg bg-dark-700 border border-dark-500 shadow-xl shadow-black/40 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-dark-500 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Core Services</span>
            <span className={`text-[9px] font-semibold ${labelClass}`}>
              {coreConnected}/{coreTotal} connected
            </span>
          </div>

          {/* Core service list */}
          <div className="max-h-52 overflow-y-auto">
            {coreEntries.length === 0 && (
              <div className="px-3 py-4 text-center text-[10px] text-gray-600">
                {loading ? 'Loading services...' : 'No service data available'}
              </div>
            )}
            {coreEntries.map(([name, svc]) => {
              const svcStatus = typeof svc === 'string' ? svc : svc?.status ?? 'unknown'
              const svcDot = SERVICE_STATUS_DOT[svcStatus] || 'bg-gray-600'
              const svcName = typeof svc === 'object' ? svc?.name || name : name
              return (
                <div key={name} className="flex items-center justify-between px-3 py-1.5 hover:bg-dark-600/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${svcDot}`} />
                    <span className="text-[10px] text-gray-300 truncate">{svcName}</span>
                  </div>
                  <span className={`text-[9px] font-mono capitalize ${
                    svcStatus === 'connected' ? 'text-accent-green' :
                    svcStatus === 'error' || svcStatus === 'disconnected' ? 'text-accent-red' :
                    'text-gray-500'
                  }`}>
                    {svcStatus === 'not_configured' ? 'n/a' : svcStatus}
                  </span>
                </div>
              )
            })}

            {/* Optional integrations header */}
            {optionalEntries.length > 0 && (
              <div className="px-3 pt-2 pb-1 border-t border-dark-500/50">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Optional Integrations</span>
              </div>
            )}
            {optionalEntries.map(([name, svc]) => {
              const svcStatus = typeof svc === 'string' ? svc : svc?.status ?? 'unknown'
              const svcDot = SERVICE_STATUS_DOT[svcStatus] || 'bg-gray-600'
              const svcName = typeof svc === 'object' ? svc?.name || name : name
              return (
                <div key={name} className="flex items-center justify-between px-3 py-1.5 hover:bg-dark-600/50 transition-colors opacity-70">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${svcDot}`} />
                    <span className="text-[10px] text-gray-400 truncate">{svcName}</span>
                  </div>
                  <span className={`text-[9px] font-mono capitalize ${
                    svcStatus === 'connected' ? 'text-accent-green' :
                    svcStatus === 'error' || svcStatus === 'disconnected' ? 'text-accent-red' :
                    'text-gray-600'
                  }`}>
                    {svcStatus === 'not_configured' ? 'not set up' : svcStatus}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-dark-500 flex items-center justify-between">
            <span className="text-[9px] text-gray-600">Auto-refreshes every {pollInterval / 1000}s</span>
            <button
              onClick={(e) => { e.stopPropagation(); fetchStatus() }}
              className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Refresh now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

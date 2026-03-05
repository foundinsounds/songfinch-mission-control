'use client'

import { useState } from 'react'
import { AGENTS } from '../lib/agents'

const QUICK_ACTIONS = [
  { label: 'Create a Task', icon: '✨', action: 'create-task', color: 'bg-accent-orange/15 text-accent-orange border-accent-orange/20' },
  { label: 'Run Agents', icon: '🚀', action: 'run-agents', color: 'bg-accent-blue/15 text-accent-blue border-accent-blue/20' },
  { label: 'Plan Campaign', icon: '📅', action: 'plan-campaign', color: 'bg-accent-purple/15 text-accent-purple border-accent-purple/20' },
  { label: 'View Analytics', icon: '📊', action: 'view-analytics', color: 'bg-accent-green/15 text-accent-green border-accent-green/20' },
]

export default function WelcomeState({ agents = [], onAction, dataSource, onRefresh }) {
  const activeAgents = agents.filter(a => a.status === 'Working' || a.status === 'Active' || a.status === 'Idle')

  // If Airtable is connected but has no tasks, show the seed pipeline UI
  if (dataSource === 'airtable-empty') {
    return <SeedPipelineState agents={agents} activeAgents={activeAgents} onRefresh={onRefresh} />
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg text-center space-y-8 animate-fade-in">
        {/* Logo / Hero */}
        <div className="space-y-3">
          <div className="text-5xl">🏰</div>
          <h1 className="text-2xl font-bold text-gray-100">Welcome to the Roundtable</h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
            Your AI marketing council is ready. Create tasks, run agents, and watch your content pipeline come alive.
          </p>
        </div>

        {/* Agent Avatars */}
        <div className="flex items-center justify-center gap-1">
          {(agents.length > 0 ? agents : AGENTS).slice(0, 10).map((agent, i) => (
            <div
              key={agent.name}
              className="w-10 h-10 rounded-full bg-dark-700 border-2 border-dark-500 flex items-center justify-center text-lg hover:scale-110 hover:border-accent-orange/40 transition-all cursor-default"
              title={`${agent.name} — ${agent.role}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {agent.emoji}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600">
          {activeAgents.length} of {agents.length || AGENTS.length} agents online
        </p>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.action}
              onClick={() => onAction && onAction(action.action)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${action.color}`}
            >
              <span className="text-lg">{action.icon}</span>
              <span className="text-[11px] font-semibold">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Tip */}
        <div className="text-[10px] text-gray-600 space-y-1">
          <p>Press <kbd className="px-1.5 py-0.5 bg-dark-600 rounded text-gray-400 font-mono text-[9px]">⌘K</kbd> for the command bar</p>
          <p>Press <kbd className="px-1.5 py-0.5 bg-dark-600 rounded text-gray-400 font-mono text-[9px]">?</kbd> for keyboard shortcuts</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seed Pipeline State — shown when Airtable is connected but empty
// ---------------------------------------------------------------------------

function SeedPipelineState({ agents, activeAgents, onRefresh }) {
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState(null)
  const [seedError, setSeedError] = useState(null)

  async function handleSeed() {
    setSeeding(true)
    setSeedResult(null)
    setSeedError(null)

    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Seed failed (${res.status})`)
      }
      const data = await res.json()
      setSeedResult(data)

      // Auto-refresh dashboard data after a short delay to let Airtable settle
      if (onRefresh) {
        setTimeout(() => onRefresh(), 1500)
      }
    } catch (err) {
      setSeedError(err.message)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg text-center space-y-8 animate-fade-in">
        {/* Connected Status */}
        <div className="space-y-3">
          <div className="text-5xl">🔗</div>
          <h1 className="text-2xl font-bold text-gray-100">Pipeline Connected</h1>
          <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
            Your Airtable base is connected but the Mission Queue is empty.
            Seed it with starter tasks so your agents have real work to process.
          </p>
        </div>

        {/* Connection indicator */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Airtable connected &mdash; 0 tasks
        </div>

        {/* Agent Avatars */}
        <div className="flex items-center justify-center gap-1">
          {(agents.length > 0 ? agents : AGENTS).slice(0, 10).map((agent, i) => (
            <div
              key={agent.name}
              className="w-10 h-10 rounded-full bg-dark-700 border-2 border-dark-500 flex items-center justify-center text-lg opacity-50 hover:opacity-100 hover:border-accent-orange/40 transition-all cursor-default"
              title={`${agent.name} — ${agent.role} (waiting for tasks)`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {agent.emoji}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600">
          {activeAgents.length} of {agents.length || AGENTS.length} agents standing by
        </p>

        {/* Seed Pipeline Button */}
        {!seedResult && (
          <div className="space-y-3">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-accent-orange/15 text-accent-orange border border-accent-orange/30 font-semibold text-sm transition-all hover:bg-accent-orange/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {seeding ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Seeding Pipeline...
                </>
              ) : (
                <>
                  <span className="text-lg">🌱</span>
                  Seed Pipeline
                </>
              )}
            </button>
            <p className="text-[10px] text-gray-600 max-w-xs mx-auto">
              Creates 15 starter tasks across ad copy, social posts, images, video scripts, blog content, and strategy.
            </p>
          </div>
        )}

        {/* Seed Results */}
        {seedResult && (
          <div className="space-y-4 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
              <span>&#10003;</span> {seedResult.summary?.created || 0} tasks seeded
            </div>

            {seedResult.summary && (
              <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto text-[10px]">
                {Object.entries(seedResult.summary.byContentType || {}).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-dark-700/50 border border-dark-600/50">
                    <span className="text-gray-400">{type}</span>
                    <span className="text-gray-200 font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {seedResult.errors && seedResult.errors.length > 0 && (
              <p className="text-[10px] text-amber-400/80">
                {seedResult.errors.length} task(s) failed to create. Check console for details.
              </p>
            )}

            <p className="text-[10px] text-gray-500">
              Refreshing dashboard...
            </p>
          </div>
        )}

        {/* Seed Error */}
        {seedError && (
          <div className="space-y-3 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              Seed failed: {seedError}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-gray-500">
                If auth is required, run this in your terminal:
              </p>
              <code className="block text-[10px] bg-dark-700/80 text-gray-300 px-4 py-2 rounded-lg font-mono text-left max-w-sm mx-auto select-all">
                curl -X POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/seed \<br />
                &nbsp;&nbsp;-H &quot;Authorization: Bearer $CRON_SECRET&quot;
              </code>
            </div>
            <button
              onClick={handleSeed}
              className="text-[11px] text-accent-orange hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Tip */}
        <div className="text-[10px] text-gray-600 space-y-1">
          <p>Press <kbd className="px-1.5 py-0.5 bg-dark-600 rounded text-gray-400 font-mono text-[9px]">⌘K</kbd> for the command bar</p>
        </div>
      </div>
    </div>
  )
}

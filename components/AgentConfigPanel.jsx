'use client'

import { useState, useCallback } from 'react'
import { MODEL_OPTIONS, AGENT_STATUSES } from '../lib/constants'

export default function AgentConfigPanel({ agent, onClose, onAgentUpdate }) {
  const [model, setModel] = useState(agent.model || 'claude-3.5-sonnet')
  const [temperature, setTemperature] = useState(agent.temperature ?? 0.7)
  const [status, setStatus] = useState(agent.status || 'Idle')
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'success' | 'error' | null

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveStatus(null)

    try {
      const res = await fetch('/api/agents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: agent.id,
          fields: {
            status,
            model,
            temperature: parseFloat(temperature),
            systemPrompt,
          },
        }),
      })

      if (!res.ok) throw new Error('Update failed')

      setSaveStatus('success')
      if (onAgentUpdate) {
        onAgentUpdate({
          ...agent,
          status,
          model,
          temperature: parseFloat(temperature),
          systemPrompt,
        })
      }

      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      console.error('Failed to save agent config:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    } finally {
      setSaving(false)
    }
  }, [agent, status, model, temperature, systemPrompt, onAgentUpdate])

  const getTypeBadge = (type) => {
    switch (type) {
      case 'EXEC': return { bg: 'bg-yellow-500/20', text: 'text-yellow-300', label: 'EXECUTIVE' }
      case 'OPS': return { bg: 'bg-indigo-500/15', text: 'text-indigo-400', label: 'OPERATIONS' }
      case 'LEAD': return { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'LEAD' }
      case 'SPC': return { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'SPECIALIST' }
      case 'INT': return { bg: 'bg-teal-500/15', text: 'text-teal-400', label: 'INTELLIGENCE' }
      default: return { bg: 'bg-gray-500/15', text: 'text-gray-400', label: type }
    }
  }

  const typeBadge = getTypeBadge(agent.type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="config-panel relative h-full w-full max-w-lg bg-dark-800 border-l border-dark-500 shadow-2xl overflow-y-auto">
        {/* Panel Header */}
        <div className="sticky top-0 z-10 bg-dark-800 border-b border-dark-500 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                style={{
                  background: `${agent.color}15`,
                  border: `2px solid ${agent.color}`,
                }}
              >
                {agent.emoji}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{agent.name}</h2>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${typeBadge.bg} ${typeBadge.text}`}>
                    {typeBadge.label}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{agent.role}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors p-1 mt-1"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Panel Body */}
        <div className="px-6 py-5 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{agent.description}</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark-700 rounded-lg p-3 text-center border border-dark-500">
              <div className="text-2xl font-bold" style={{ color: agent.color }}>{agent.tasksCompleted}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Tasks Done</div>
            </div>
            <div className="bg-dark-700 rounded-lg p-3 text-center border border-dark-500">
              <div className="text-2xl font-bold">{temperature}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Temperature</div>
            </div>
            <div className="bg-dark-700 rounded-lg p-3 text-center border border-dark-500">
              <div className="text-lg font-bold text-gray-200 truncate">{MODEL_OPTIONS.find(m => m.value === model)?.label.split(' ').slice(-1)[0] || model}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Model</div>
            </div>
          </div>

          {/* Status Toggle */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Status</h3>
            <div className="flex gap-2">
              {AGENT_STATUSES.map((s) => {
                const isActive = status === s
                const statusColors = {
                  Active: 'border-blue-500 bg-blue-500/15 text-blue-400',
                  Working: 'border-green-500 bg-green-500/15 text-green-400',
                  Idle: 'border-gray-500 bg-gray-500/15 text-gray-400',
                }
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                      isActive
                        ? statusColors[s]
                        : 'border-dark-500 bg-dark-700 text-gray-500 hover:border-dark-400'
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Model Dropdown */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Model</h3>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-orange/50 focus:ring-1 focus:ring-accent-orange/30 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
              }}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Temperature Slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Temperature</h3>
              <span className="text-sm font-mono font-bold text-accent-orange">{temperature.toFixed(1)}</span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer temperature-slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #f97316 ${temperature * 100}%, #2a2a3a ${temperature * 100}%, #2a2a3a 100%)`,
                }}
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-gray-600">Precise</span>
                <span className="text-[10px] text-gray-600">Creative</span>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">System Prompt</h3>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={10}
              className="w-full bg-dark-900 border border-dark-500 rounded-lg px-4 py-3 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-accent-orange/50 focus:ring-1 focus:ring-accent-orange/30 resize-none"
              placeholder="Enter the system prompt for this agent..."
            />
            <div className="text-[10px] text-gray-600 mt-1.5">
              {systemPrompt.length} characters
            </div>
          </div>
        </div>

        {/* Panel Footer */}
        <div className="sticky bottom-0 bg-dark-800 border-t border-dark-500 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {saveStatus === 'success' && (
                <span className="text-sm text-accent-green flex items-center gap-1.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Saved to Airtable
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-sm text-accent-red flex items-center gap-1.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                  Failed to save (offline mode?)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="text-sm px-5 py-2 rounded-lg bg-dark-600 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm px-5 py-2 rounded-lg bg-accent-orange/20 text-accent-orange hover:bg-accent-orange/30 transition-colors border border-accent-orange/30 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { MODEL_OPTIONS, AGENT_STATUSES, MODEL_LEGACY_MAP } from '../lib/constants'
import { computeAgentMetrics } from '../lib/agentMetrics'

// Improvement suggestions based on agent type
const IMPROVEMENT_SUGGESTIONS = {
  EXEC: [
    { area: 'Strategic Planning', suggestion: 'Add quarterly OKR templates to system prompt for structured goal setting', impact: 'High' },
    { area: 'Cross-Agent Coordination', suggestion: 'Enable automated task delegation based on agent workload and specialization', impact: 'High' },
    { area: 'Market Analysis', suggestion: 'Integrate real-time competitor monitoring data feeds', impact: 'Medium' },
  ],
  OPS: [
    { area: 'Workflow Automation', suggestion: 'Add auto-escalation rules for tasks stuck in Review > 24h', impact: 'High' },
    { area: 'Quality Assurance', suggestion: 'Implement output scoring rubric for consistent content quality checks', impact: 'High' },
    { area: 'Resource Planning', suggestion: 'Add workload balancing algorithm to distribute tasks evenly', impact: 'Medium' },
  ],
  LEAD: [
    { area: 'Creative Direction', suggestion: 'Add mood board generation capability for campaign briefs', impact: 'High' },
    { area: 'Brand Consistency', suggestion: 'Implement tone-of-voice checker across all agent outputs', impact: 'Medium' },
    { area: 'Campaign Orchestration', suggestion: 'Enable multi-channel campaign planning with timeline view', impact: 'High' },
  ],
  SPC: [
    { area: 'Output Quality', suggestion: 'Fine-tune temperature for optimal creative vs accuracy balance', impact: 'High' },
    { area: 'Content Variety', suggestion: 'Add content format templates (listicles, how-tos, interviews)', impact: 'Medium' },
    { area: 'Platform Optimization', suggestion: 'Add platform-specific formatting rules to system prompt', impact: 'Medium' },
  ],
  INT: [
    { area: 'Data Sources', suggestion: 'Add more competitive intelligence feeds and social listening tools', impact: 'High' },
    { area: 'Trend Detection', suggestion: 'Implement trend scoring algorithm for prioritizing insights', impact: 'Medium' },
    { area: 'Report Automation', suggestion: 'Generate weekly digest reports automatically from findings', impact: 'Medium' },
  ],
}


function ChevronIcon({ direction = 'right', size = 16 }) {
  const rotation = direction === 'down' ? 90 : direction === 'left' ? 180 : direction === 'up' ? 270 : 0
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s ease' }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function BarChart({ value, max = 100, color = '#f97316' }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="w-full h-2 bg-dark-600 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

export default function AgentConfigPanel({ agent, onClose, onAgentUpdate, tasks = [] }) {
  // Resolve legacy model values to current ones
  const resolvedModel = MODEL_LEGACY_MAP[agent.model] || agent.model || 'claude-sonnet-4-6'
  const [model, setModel] = useState(resolvedModel)
  const [temperature, setTemperature] = useState(agent.temperature ?? 0.7)
  const [status, setStatus] = useState(agent.status || 'Idle')
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'config' | 'improve'
  const [expandedSections, setExpandedSections] = useState({ prompt: false })
  const [aiLoading, setAiLoading] = useState(null) // 'improve' | 'suggest-prompt' | null
  const [aiImprovements, setAiImprovements] = useState(null)
  const [suggestedPrompt, setSuggestedPrompt] = useState(null)

  const metrics = useMemo(() => computeAgentMetrics(tasks, agent.name), [tasks, agent.name])
  const improvements = IMPROVEMENT_SUGGESTIONS[agent.type] || IMPROVEMENT_SUGGESTIONS['SPC']

  // Close panel on Escape key press (WCAG dialog pattern)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Update failed')
      }

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

  // AI-powered improvement analysis
  const handleAiImprove = useCallback(async () => {
    setAiLoading('improve')
    try {
      const res = await fetch('/api/agents/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: { ...agent, model, temperature, systemPrompt }, action: 'improve' }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setAiImprovements(data.improvements)
    } catch (err) {
      console.error('AI improve error:', err)
    } finally {
      setAiLoading(null)
    }
  }, [agent, model, temperature, systemPrompt])

  // AI-powered system prompt suggestion
  const handleSuggestPrompt = useCallback(async () => {
    setAiLoading('suggest-prompt')
    try {
      const res = await fetch('/api/agents/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: { ...agent, model, temperature, systemPrompt }, action: 'suggest-prompt' }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setSuggestedPrompt(data.prompt)
    } catch (err) {
      console.error('AI suggest error:', err)
    } finally {
      setAiLoading(null)
    }
  }, [agent, model, temperature, systemPrompt])

  const getTypeBadge = (type) => {
    switch (type) {
      case 'EXEC': return { bg: 'bg-yellow-500/20', text: 'text-yellow-300', label: 'EXECUTIVE', desc: 'Strategic leadership and high-level decision making' }
      case 'OPS': return { bg: 'bg-indigo-500/15', text: 'text-indigo-400', label: 'OPERATIONS', desc: 'Workflow management and operational oversight' }
      case 'LEAD': return { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'LEAD', desc: 'Creative direction and team coordination' }
      case 'SPC': return { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'SPECIALIST', desc: 'Domain expertise and content production' }
      case 'INT': return { bg: 'bg-teal-500/15', text: 'text-teal-400', label: 'INTELLIGENCE', desc: 'Research, analysis, and strategic insights' }
      default: return { bg: 'bg-gray-500/15', text: 'text-gray-400', label: type, desc: '' }
    }
  }

  const typeBadge = getTypeBadge(agent.type)

  const tabs = [
    { key: 'overview', label: 'Overview', icon: '\u{1F4CA}' },
    { key: 'config', label: 'Configure', icon: '\u2699\uFE0F' },
    { key: 'improve', label: 'Improve', icon: '\u{1F680}' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end" role="dialog" aria-modal="true" aria-label={`${agent.name} agent configuration`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="config-panel relative h-full w-full max-w-xl bg-dark-800 border-l border-dark-500 shadow-2xl flex flex-col overflow-hidden">
        {/* Panel Header */}
        <div className="shrink-0 bg-dark-800 border-b border-dark-500 px-6 py-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
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
                <p className="text-[11px] text-gray-600 mt-1">{typeBadge.desc}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors p-1 mt-1"
              aria-label="Close agent configuration panel"
            >
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1" role="tablist" aria-label="Agent configuration tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`tabpanel-${tab.key}`}
                id={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/30'
                    : 'bg-dark-700 text-gray-500 border border-transparent hover:text-gray-300 hover:bg-dark-600'
                }`}
              >
                <span className="mr-1" aria-hidden="true">{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ===== OVERVIEW TAB ===== */}
          {activeTab === 'overview' && (
            <div role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview">
              {/* Description */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">About</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{agent.description}</p>
              </div>

              {/* Stats Grid */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Performance</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-dark-700 rounded-lg p-3 border border-dark-500">
                    <div className="text-2xl font-bold" style={{ color: agent.color }}>{metrics.doneTasks}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Total Completed</div>
                  </div>
                  <div className="bg-dark-700 rounded-lg p-3 border border-dark-500">
                    <div className="text-2xl font-bold text-accent-blue">{metrics.tasksThisWeek}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">This Week</div>
                  </div>
                  <div className="bg-dark-700 rounded-lg p-3 border border-dark-500">
                    <div className="text-2xl font-bold text-accent-green">{metrics.completionRate}%</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Completion Rate</div>
                    <BarChart value={metrics.completionRate} color="#22c55e" />
                  </div>
                  <div className="bg-dark-700 rounded-lg p-3 border border-dark-500">
                    <div className="text-2xl font-bold text-accent-purple">{metrics.activeTasks}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Active Tasks</div>
                  </div>
                </div>
              </div>

              {/* Current Config Summary */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Current Configuration</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-dark-700 rounded-lg p-3 border border-dark-500">
                    <span className="text-xs text-gray-400">Model</span>
                    <span className="text-sm font-semibold text-gray-200">{MODEL_OPTIONS.find(m => m.value === model)?.label || model}</span>
                  </div>
                  <div className="flex items-center justify-between bg-dark-700 rounded-lg p-3 border border-dark-500">
                    <span className="text-xs text-gray-400">Temperature</span>
                    <div className="flex items-center gap-2">
                      <BarChart value={temperature * 100} color="#f97316" />
                      <span className="text-sm font-mono font-bold text-accent-orange w-8 text-right">{temperature.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-dark-700 rounded-lg p-3 border border-dark-500">
                    <span className="text-xs text-gray-400">Status</span>
                    <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                      status === 'Working' ? 'bg-green-500/15 text-green-400' :
                      status === 'Active' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-gray-500/15 text-gray-400'
                    }`}>{status}</span>
                  </div>
                  <div className="flex items-center justify-between bg-dark-700 rounded-lg p-3 border border-dark-500">
                    <span className="text-xs text-gray-400">Output Volume</span>
                    <span className="text-sm font-semibold text-gray-200">
                      {metrics.outputWords > 0
                        ? `${metrics.outputWords.toLocaleString()} words`
                        : 'No output yet'}
                    </span>
                  </div>
                </div>
              </div>

              {/* System Prompt Preview */}
              <div>
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, prompt: !prev.prompt }))}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">System Prompt</h3>
                  <ChevronIcon direction={expandedSections.prompt ? 'down' : 'right'} size={14} />
                </button>
                {expandedSections.prompt && (
                  <div className="mt-2 bg-dark-900 rounded-lg p-4 border border-dark-500 max-h-48 overflow-y-auto">
                    <pre className="text-[11px] text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
                      {systemPrompt || 'No system prompt configured. Click Configure to add one.'}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== CONFIGURE TAB ===== */}
          {activeTab === 'config' && (
            <div role="tabpanel" id="tabpanel-config" aria-labelledby="tab-config">
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
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">AI Model</h3>
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
                <p className="text-[10px] text-gray-600 mt-1.5">
                  {model.includes('claude') ? 'Anthropic' : model.includes('gpt') ? 'OpenAI' : 'Google'} model
                </p>
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
                    <span className="text-[10px] text-gray-600">Precise (0.0)</span>
                    <span className="text-[10px] text-gray-600">Creative (1.0)</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600 mt-2">
                  {temperature <= 0.3 ? 'Low temperature: More deterministic, factual outputs. Best for data analysis and reporting.' :
                   temperature <= 0.6 ? 'Medium temperature: Balanced creativity and accuracy. Good for general content.' :
                   'High temperature: More creative and varied outputs. Best for brainstorming and creative writing.'}
                </p>
              </div>

              {/* System Prompt Editor */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">System Prompt</h3>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={12}
                  className="w-full bg-dark-900 border border-dark-500 rounded-lg px-4 py-3 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-accent-orange/50 focus:ring-1 focus:ring-accent-orange/30 resize-none"
                  placeholder="Enter the system prompt for this agent..."
                />
                <div className="flex justify-between mt-1.5">
                  <div className="text-[10px] text-gray-600">
                    {systemPrompt.length} characters
                  </div>
                  <div className="text-[10px] text-gray-600">
                    ~{Math.ceil(systemPrompt.length / 4)} tokens
                  </div>
                </div>

                {/* Generate System Prompt Button */}
                <button
                  onClick={async () => {
                    setAiLoading('generate-prompt')
                    try {
                      const res = await fetch('/api/agents/improve', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ agent: { ...agent, model, temperature, systemPrompt }, action: 'suggest-prompt' }),
                      })
                      if (!res.ok) throw new Error('Failed')
                      const data = await res.json()
                      setSystemPrompt(data.prompt)
                    } catch (err) {
                      console.error('Generate prompt error:', err)
                    } finally {
                      setAiLoading(null)
                    }
                  }}
                  disabled={aiLoading === 'generate-prompt'}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent-orange/10 text-accent-orange border border-accent-orange/25 hover:bg-accent-orange/20 hover:border-accent-orange/40 transition-all text-xs font-semibold disabled:opacity-50"
                >
                  {aiLoading === 'generate-prompt' ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-accent-orange/30 border-t-accent-orange rounded-full animate-spin"></div>
                      Generating prompt for {agent.name}...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      Generate System Prompt
                    </>
                  )}
                </button>
                {!systemPrompt && (
                  <p className="text-[10px] text-gray-600 mt-1.5 text-center">
                    AI will generate a tailored prompt based on this agent&apos;s role and type
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ===== IMPROVE TAB ===== */}
          {activeTab === 'improve' && (
            <div role="tabpanel" id="tabpanel-improve" aria-labelledby="tab-improve">
              {/* AI Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAiImprove}
                  disabled={aiLoading === 'improve'}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-accent-purple/15 text-accent-purple border border-accent-purple/30 hover:bg-accent-purple/25 transition-all text-sm font-semibold disabled:opacity-50"
                >
                  {aiLoading === 'improve' ? (
                    <><div className="w-4 h-4 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"></div> Analyzing...</>
                  ) : (
                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Analyze & Improve</>
                  )}
                </button>
                <button
                  onClick={handleSuggestPrompt}
                  disabled={aiLoading === 'suggest-prompt'}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-accent-blue/15 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/25 transition-all text-sm font-semibold disabled:opacity-50"
                >
                  {aiLoading === 'suggest-prompt' ? (
                    <><div className="w-4 h-4 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div> Generating...</>
                  ) : (
                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Suggest System Prompt</>
                  )}
                </button>
              </div>

              {/* Suggested System Prompt Result */}
              {suggestedPrompt && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-accent-blue uppercase tracking-wider">AI-Generated System Prompt</h3>
                    <button
                      onClick={() => {
                        setSystemPrompt(suggestedPrompt)
                        setSuggestedPrompt(null)
                        setActiveTab('config')
                      }}
                      className="text-[10px] font-semibold px-3 py-1 rounded bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/30 transition-colors"
                    >
                      Apply to Config
                    </button>
                  </div>
                  <div className="bg-dark-900 rounded-lg p-4 border border-accent-blue/20 max-h-64 overflow-y-auto">
                    <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{suggestedPrompt}</pre>
                  </div>
                  <button
                    onClick={() => setSuggestedPrompt(null)}
                    className="text-[10px] text-gray-600 hover:text-gray-400 mt-1.5 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* AI Improvements Result */}
              {aiImprovements ? (
                <div>
                  <h3 className="text-xs font-semibold text-accent-purple uppercase tracking-wider mb-3">AI Analysis Results</h3>
                  <div className="space-y-3">
                    {aiImprovements.map((item, i) => (
                      <div key={i} className="bg-dark-700 rounded-lg p-4 border border-dark-500 hover:border-accent-purple/30 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-200">{item.area}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                              item.impact === 'High' ? 'bg-red-500/15 text-red-400' :
                              item.impact === 'Medium' ? 'bg-yellow-500/15 text-yellow-400' :
                              'bg-gray-500/15 text-gray-400'
                            }`}>
                              {item.impact}
                            </span>
                            {item.action && (
                              <span className="text-[9px] font-mono text-gray-600 bg-dark-600 px-1.5 py-0.5 rounded">{item.action}</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{item.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Default Improvement Suggestions */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Quick Improvements
                    </h3>
                    <div className="space-y-3">
                      {improvements.map((item, i) => (
                        <div key={i} className="bg-dark-700 rounded-lg p-4 border border-dark-500 hover:border-dark-400 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-200">{item.area}</span>
                            <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                              item.impact === 'High' ? 'bg-red-500/15 text-red-400' :
                              item.impact === 'Medium' ? 'bg-yellow-500/15 text-yellow-400' :
                              'bg-gray-500/15 text-gray-400'
                            }`}>
                              {item.impact} Impact
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">{item.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Agent Health Score */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Agent Health</h3>
                <div className="bg-dark-700 rounded-lg p-4 border border-dark-500">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-200">Completion Rate</span>
                    <span className="text-2xl font-bold text-accent-green">{metrics.completionRate}%</span>
                  </div>
                  <BarChart value={metrics.completionRate} color="#22c55e" />
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-accent-blue">{metrics.doneTasks}</div>
                      <div className="text-[9px] text-gray-500 uppercase">Done</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-accent-purple">{metrics.tasksByStatus.Review + metrics.tasksByStatus['In Progress']}</div>
                      <div className="text-[9px] text-gray-500 uppercase">In Pipeline</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-accent-orange">{metrics.avgOutputWords > 0 ? metrics.avgOutputWords.toLocaleString() : '—'}</div>
                      <div className="text-[9px] text-gray-500 uppercase">Avg Words</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prompt Status */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Prompt Status</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs text-gray-400">
                    <span className={systemPrompt.length > 100 ? 'text-accent-green' : 'text-accent-red'}>
                      {systemPrompt.length > 100 ? '+' : '!'}
                    </span>
                    <span>
                      {systemPrompt.length > 0
                        ? `${systemPrompt.length} chars (~${Math.ceil(systemPrompt.length / 4)} tokens)`
                        : 'Empty - click "Suggest System Prompt" to generate one'}
                    </span>
                  </div>
                  {systemPrompt.length > 0 && systemPrompt.length < 200 && (
                    <div className="flex items-start gap-2 text-xs text-accent-yellow">
                      <span>!</span>
                      <span>System prompt is short. Use "Suggest System Prompt" for a more detailed version.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panel Footer */}
        <div className="shrink-0 bg-dark-800 border-t border-dark-500 px-6 py-4">
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
                  Failed to save
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="text-sm px-5 py-2 rounded-lg bg-dark-600 text-gray-400 hover:text-white transition-colors"
              >
                Close
              </button>
              {activeTab === 'config' && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-sm px-5 py-2 rounded-lg bg-accent-orange/20 text-accent-orange hover:bg-accent-orange/30 transition-colors border border-accent-orange/30 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

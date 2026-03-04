'use client'

import { useState, useMemo } from 'react'

const DEFAULT_TESTS = [
  {
    id: 'ab1',
    name: 'Holiday CTA Test',
    type: 'copy',
    status: 'running',
    variants: [
      { id: 'a', label: 'A', content: 'Give the gift of a song', impressions: 1240, clicks: 87, conversions: 12 },
      { id: 'b', label: 'B', content: 'Make them cry happy tears', impressions: 1180, clicks: 112, conversions: 18 },
    ],
    agent: 'HOOK',
    startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    goal: 'conversions',
  },
  {
    id: 'ab2',
    name: 'Email Subject Line',
    type: 'email',
    status: 'completed',
    variants: [
      { id: 'a', label: 'A', content: 'Your song is ready!', impressions: 5000, clicks: 450, conversions: 120 },
      { id: 'b', label: 'B', content: 'Something special just for you', impressions: 5000, clicks: 380, conversions: 95 },
    ],
    agent: 'HOOK',
    startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    winner: 'a',
    goal: 'clicks',
  },
]

export default function ABTestPipeline({ agents }) {
  const [tests, setTests] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_TESTS
    const saved = localStorage.getItem('roundtable-abtests')
    return saved ? JSON.parse(saved) : DEFAULT_TESTS
  })
  const [showCreate, setShowCreate] = useState(false)
  const [newTest, setNewTest] = useState({ name: '', type: 'copy', variantA: '', variantB: '', agent: '', goal: 'clicks' })
  const [filterStatus, setFilterStatus] = useState('all')

  const save = (updated) => {
    setTests(updated)
    localStorage.setItem('roundtable-abtests', JSON.stringify(updated))
  }

  const createTest = () => {
    if (!newTest.name || !newTest.variantA || !newTest.variantB) return
    const test = {
      id: `ab-${Date.now()}`,
      name: newTest.name,
      type: newTest.type,
      status: 'running',
      variants: [
        { id: 'a', label: 'A', content: newTest.variantA, impressions: 0, clicks: 0, conversions: 0 },
        { id: 'b', label: 'B', content: newTest.variantB, impressions: 0, clicks: 0, conversions: 0 },
      ],
      agent: newTest.agent || agents[0]?.name || 'HOOK',
      startedAt: new Date().toISOString(),
      goal: newTest.goal,
    }
    save([test, ...tests])
    setNewTest({ name: '', type: 'copy', variantA: '', variantB: '', agent: '', goal: 'clicks' })
    setShowCreate(false)
  }

  const declareWinner = (testId, variantId) => {
    save(tests.map(t => t.id === testId ? { ...t, status: 'completed', winner: variantId } : t))
  }

  const deleteTest = (testId) => {
    save(tests.filter(t => t.id !== testId))
  }

  const filtered = tests.filter(t => filterStatus === 'all' || t.status === filterStatus)

  const getMetric = (variant, goal) => {
    if (goal === 'conversions') return variant.impressions > 0 ? ((variant.conversions / variant.impressions) * 100).toFixed(1) + '%' : '0%'
    if (goal === 'clicks') return variant.impressions > 0 ? ((variant.clicks / variant.impressions) * 100).toFixed(1) + '%' : '0%'
    return variant.impressions
  }

  const getMetricLabel = (goal) => {
    if (goal === 'conversions') return 'Conv. Rate'
    if (goal === 'clicks') return 'CTR'
    return 'Impressions'
  }

  const stats = useMemo(() => ({
    running: tests.filter(t => t.status === 'running').length,
    completed: tests.filter(t => t.status === 'completed').length,
    total: tests.length,
  }), [tests])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <h2 className="text-sm font-bold text-gray-200">A/B Testing</h2>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-green-400">{stats.running} running</span>
          <span className="text-gray-500">{stats.completed} completed</span>
          <button onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1 bg-accent-orange/20 text-accent-orange rounded-lg hover:bg-accent-orange/30 transition-colors">
            + New Test
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 py-2 border-b border-dark-500 flex items-center gap-2 bg-dark-800/30">
        {['all', 'running', 'completed'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-[10px] px-2.5 py-1 rounded-full capitalize transition-colors ${
              filterStatus === s ? 'bg-accent-orange/20 text-accent-orange' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="px-4 py-3 border-b border-dark-500 bg-dark-700/50 space-y-2">
          <div className="flex gap-2">
            <input value={newTest.name} onChange={e => setNewTest({ ...newTest, name: e.target.value })}
              placeholder="Test name..." className="flex-1 bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600" />
            <select value={newTest.type} onChange={e => setNewTest({ ...newTest, type: e.target.value })}
              className="bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-xs text-gray-200">
              <option value="copy">Copy</option>
              <option value="email">Email</option>
              <option value="ad">Ad</option>
              <option value="landing">Landing Page</option>
            </select>
            <select value={newTest.goal} onChange={e => setNewTest({ ...newTest, goal: e.target.value })}
              className="bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-xs text-gray-200">
              <option value="clicks">Optimize CTR</option>
              <option value="conversions">Optimize Conversions</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={newTest.variantA} onChange={e => setNewTest({ ...newTest, variantA: e.target.value })}
              placeholder="Variant A content..." className="bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600" />
            <input value={newTest.variantB} onChange={e => setNewTest({ ...newTest, variantB: e.target.value })}
              placeholder="Variant B content..." className="bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600" />
          </div>
          <div className="flex gap-2">
            <select value={newTest.agent} onChange={e => setNewTest({ ...newTest, agent: e.target.value })}
              className="bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-xs text-gray-200">
              <option value="">Assign agent...</option>
              {agents.map(a => <option key={a.id} value={a.name}>{a.emoji} {a.name}</option>)}
            </select>
            <button onClick={createTest}
              className="text-[10px] px-3 py-1.5 bg-accent-green/20 text-accent-green rounded hover:bg-accent-green/30 transition-colors">
              Create Test
            </button>
            <button onClick={() => setShowCreate(false)}
              className="text-[10px] px-3 py-1.5 text-gray-500 hover:text-gray-300 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Test Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.map(test => {
          const agent = agents.find(a => a.name === test.agent)
          const lead = test.variants.reduce((best, v) => {
            const metric = test.goal === 'conversions' ? v.conversions : v.clicks
            const bestMetric = test.goal === 'conversions' ? best.conversions : best.clicks
            return metric > bestMetric ? v : best
          }, test.variants[0])

          return (
            <div key={test.id} className="bg-dark-700 border border-dark-500 rounded-lg p-4 hover:border-dark-400 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${test.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                  <h3 className="text-sm font-bold">{test.name}</h3>
                  <span className="text-[9px] px-1.5 py-0.5 bg-dark-600 text-gray-400 rounded">{test.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  {agent && <span className="text-[10px] text-gray-500">{agent.emoji} {agent.name}</span>}
                  <button onClick={() => deleteTest(test.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>

              {/* Variants */}
              <div className="grid grid-cols-2 gap-3">
                {test.variants.map(variant => {
                  const isWinner = test.winner === variant.id
                  const isLead = lead.id === variant.id && test.status === 'running'
                  return (
                    <div key={variant.id} className={`bg-dark-600 rounded-lg p-3 border ${
                      isWinner ? 'border-accent-green' : isLead ? 'border-accent-orange/50' : 'border-dark-500'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-bold ${isWinner ? 'text-accent-green' : 'text-gray-300'}`}>
                          Variant {variant.label} {isWinner && ' (Winner)'}
                        </span>
                        <span className="text-[10px] text-gray-500">{getMetricLabel(test.goal)}: {getMetric(variant, test.goal)}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-2 line-clamp-2">{variant.content}</p>
                      <div className="flex items-center gap-3 text-[9px] text-gray-500">
                        <span>{variant.impressions.toLocaleString()} imp</span>
                        <span>{variant.clicks} clicks</span>
                        <span>{variant.conversions} conv</span>
                      </div>
                      {test.status === 'running' && !test.winner && (
                        <button onClick={() => declareWinner(test.id, variant.id)}
                          className="mt-2 text-[9px] px-2 py-1 bg-accent-green/10 text-accent-green rounded hover:bg-accent-green/20 transition-colors w-full">
                          Declare Winner
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-600 text-sm">No tests to show</div>
        )}
      </div>
    </div>
  )
}

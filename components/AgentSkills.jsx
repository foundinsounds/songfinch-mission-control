'use client'

import { useState, useMemo } from 'react'

const DEFAULT_SKILLS = {
  SCOUT: [
    { id: 's1', name: 'Trend Analysis', type: 'core', description: 'Analyze trending topics and hashtags across platforms', enabled: true },
    { id: 's2', name: 'Competitor Watch', type: 'core', description: 'Monitor competitor content and strategies', enabled: true },
    { id: 's3', name: 'Audience Insights', type: 'tool', description: 'Deep-dive into audience demographics and behavior', enabled: true },
    { id: 's4', name: 'Social Listening', type: 'tool', description: 'Track brand mentions and sentiment', enabled: false },
  ],
  FLOW: [
    { id: 'f1', name: 'Task Routing', type: 'core', description: 'Intelligently route tasks to the right agent', enabled: true },
    { id: 'f2', name: 'Priority Balancing', type: 'core', description: 'Balance workload across agents', enabled: true },
    { id: 'f3', name: 'Deadline Tracking', type: 'tool', description: 'Monitor and enforce deadlines', enabled: true },
    { id: 'f4', name: 'Dependency Resolution', type: 'tool', description: 'Resolve task dependencies automatically', enabled: false },
  ],
  CMO: [
    { id: 'c1', name: 'Strategy Generation', type: 'core', description: 'Generate marketing strategies from goals', enabled: true },
    { id: 'c2', name: 'Brand Voice', type: 'core', description: 'Maintain consistent brand messaging', enabled: true },
    { id: 'c3', name: 'ROI Forecasting', type: 'tool', description: 'Predict campaign ROI from historical data', enabled: false },
  ],
  HOOK: [
    { id: 'h1', name: 'Headline Generation', type: 'core', description: 'Create compelling headlines and hooks', enabled: true },
    { id: 'h2', name: 'CTA Optimization', type: 'core', description: 'Optimize calls-to-action for conversion', enabled: true },
    { id: 'h3', name: 'A/B Variants', type: 'tool', description: 'Generate multiple copy variants for testing', enabled: true },
  ],
  LENS: [
    { id: 'l1', name: 'Visual Analysis', type: 'core', description: 'Analyze image composition and effectiveness', enabled: true },
    { id: 'l2', name: 'Alt Text Generation', type: 'core', description: 'Generate accessible alt text for images', enabled: true },
    { id: 'l3', name: 'Color Palette', type: 'tool', description: 'Extract and suggest color palettes', enabled: false },
  ],
  STORY: [
    { id: 'st1', name: 'Narrative Building', type: 'core', description: 'Create compelling brand narratives', enabled: true },
    { id: 'st2', name: 'Song Story Framing', type: 'core', description: 'Frame customer song stories for marketing', enabled: true },
    { id: 'st3', name: 'Emotional Mapping', type: 'tool', description: 'Map emotional arcs in content', enabled: true },
  ],
  MUSE: [
    { id: 'm1', name: 'Brainstorming', type: 'core', description: 'Generate creative content ideas', enabled: true },
    { id: 'm2', name: 'Remix Content', type: 'core', description: 'Repurpose content across formats', enabled: true },
    { id: 'm3', name: 'Trend Fusion', type: 'tool', description: 'Combine trends with brand themes', enabled: false },
  ],
  PULSE: [
    { id: 'p1', name: 'Engagement Tracking', type: 'core', description: 'Track content engagement metrics', enabled: true },
    { id: 'p2', name: 'Performance Reports', type: 'core', description: 'Generate performance summaries', enabled: true },
    { id: 'p3', name: 'Anomaly Detection', type: 'tool', description: 'Detect unusual metric changes', enabled: false },
  ],
  CHIEF: [
    { id: 'ch1', name: 'Council Orchestration', type: 'core', description: 'Coordinate multi-agent workflows', enabled: true },
    { id: 'ch2', name: 'Quality Review', type: 'core', description: 'Review and approve agent outputs', enabled: true },
    { id: 'ch3', name: 'Escalation Handling', type: 'tool', description: 'Handle escalated issues and conflicts', enabled: true },
  ],
  PIXEL: [
    { id: 'px1', name: 'Figma Integration', type: 'core', description: 'Pull design context from Figma files', enabled: true },
    { id: 'px2', name: 'CSS Generation', type: 'core', description: 'Generate CSS from design specs', enabled: true },
    { id: 'px3', name: 'Responsive Layouts', type: 'tool', description: 'Create responsive layout implementations', enabled: true },
    { id: 'px4', name: 'Design Tokens', type: 'tool', description: 'Extract and manage design tokens', enabled: false },
  ],
}

export default function AgentSkills({ agents }) {
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [skills, setSkills] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_SKILLS
    const saved = localStorage.getItem('roundtable-skills')
    return saved ? JSON.parse(saved) : DEFAULT_SKILLS
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSkill, setNewSkill] = useState({ name: '', type: 'tool', description: '' })

  const save = (updated) => {
    setSkills(updated)
    localStorage.setItem('roundtable-skills', JSON.stringify(updated))
  }

  const toggleSkill = (agentName, skillId) => {
    const updated = { ...skills }
    updated[agentName] = updated[agentName].map(s =>
      s.id === skillId ? { ...s, enabled: !s.enabled } : s
    )
    save(updated)
  }

  const addSkill = (agentName) => {
    if (!newSkill.name) return
    const updated = { ...skills }
    const id = `custom-${Date.now()}`
    updated[agentName] = [...(updated[agentName] || []), { ...newSkill, id, enabled: true }]
    save(updated)
    setNewSkill({ name: '', type: 'tool', description: '' })
    setShowAddForm(false)
  }

  const removeSkill = (agentName, skillId) => {
    const updated = { ...skills }
    updated[agentName] = updated[agentName].filter(s => s.id !== skillId)
    save(updated)
  }

  const stats = useMemo(() => {
    let total = 0, enabled = 0, core = 0, tools = 0
    Object.values(skills).forEach(agentSkills => {
      agentSkills.forEach(s => {
        total++
        if (s.enabled) enabled++
        if (s.type === 'core') core++
        else tools++
      })
    })
    return { total, enabled, core, tools }
  }, [skills])

  const activeAgent = agents.find(a => a.name === selectedAgent) || agents[0]
  const agentName = activeAgent?.name
  const agentSkills = skills[agentName] || []

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <h2 className="text-sm font-bold text-gray-200">Agent Skills & Tools</h2>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-gray-500">{stats.total} total</span>
          <span className="text-green-400">{stats.enabled} enabled</span>
          <span className="text-blue-400">{stats.core} core</span>
          <span className="text-purple-400">{stats.tools} tools</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Agent List */}
        <div className="w-48 border-r border-dark-500 overflow-y-auto bg-dark-800/30">
          {agents.map(agent => {
            const aSkills = skills[agent.name] || []
            const enabledCount = aSkills.filter(s => s.enabled).length
            return (
              <button key={agent.id} onClick={() => { setSelectedAgent(agent.name); setShowAddForm(false) }}
                className={`w-full text-left px-3 py-2.5 border-b border-dark-500/50 flex items-center gap-2 transition-colors ${
                  agentName === agent.name ? 'bg-dark-600 border-l-2 border-l-accent-orange' : 'hover:bg-dark-700'
                }`}>
                <span className="text-base">{agent.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{agent.name}</div>
                  <div className="text-[10px] text-gray-500">{enabledCount}/{aSkills.length} active</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Skills Panel */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeAgent && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{activeAgent.emoji}</span>
                  <div>
                    <h3 className="text-sm font-bold">{activeAgent.name}</h3>
                    <p className="text-[10px] text-gray-500">{activeAgent.role}</p>
                  </div>
                </div>
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="text-[10px] px-3 py-1.5 bg-accent-orange/20 text-accent-orange rounded-lg hover:bg-accent-orange/30 transition-colors">
                  + Add Skill
                </button>
              </div>

              {/* Add Form */}
              {showAddForm && (
                <div className="bg-dark-700 border border-dark-500 rounded-lg p-3 mb-4 space-y-2">
                  <input value={newSkill.name} onChange={e => setNewSkill({ ...newSkill, name: e.target.value })}
                    placeholder="Skill name..." className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600" />
                  <input value={newSkill.description} onChange={e => setNewSkill({ ...newSkill, description: e.target.value })}
                    placeholder="Description..." className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600" />
                  <div className="flex items-center gap-2">
                    <select value={newSkill.type} onChange={e => setNewSkill({ ...newSkill, type: e.target.value })}
                      className="bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-xs text-gray-200">
                      <option value="core">Core Skill</option>
                      <option value="tool">Tool</option>
                    </select>
                    <button onClick={() => addSkill(agentName)}
                      className="text-[10px] px-3 py-1.5 bg-accent-green/20 text-accent-green rounded hover:bg-accent-green/30 transition-colors">
                      Add
                    </button>
                    <button onClick={() => setShowAddForm(false)}
                      className="text-[10px] px-3 py-1.5 text-gray-500 hover:text-gray-300 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Skills List */}
              <div className="space-y-2">
                {agentSkills.map(skill => (
                  <div key={skill.id} className={`bg-dark-700 border rounded-lg p-3 flex items-center gap-3 transition-colors ${
                    skill.enabled ? 'border-dark-500 hover:border-dark-400' : 'border-dark-600 opacity-60'
                  }`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${skill.type === 'core' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{skill.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                          skill.type === 'core' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>{skill.type}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{skill.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleSkill(agentName, skill.id)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${
                          skill.enabled ? 'bg-accent-green' : 'bg-dark-500'
                        }`}>
                        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${
                          skill.enabled ? 'left-4.5 right-0.5' : 'left-0.5'
                        }`} style={{ left: skill.enabled ? '18px' : '2px' }} />
                      </button>
                      {skill.id.startsWith('custom-') && (
                        <button onClick={() => removeSkill(agentName, skill.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

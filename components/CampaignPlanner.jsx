'use client'

import { useState, useMemo } from 'react'

const CAMPAIGN_STORAGE = 'roundtable-campaigns'

function getStoredCampaigns() {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(CAMPAIGN_STORAGE) || '[]')
  } catch { return [] }
}

function storeCampaigns(campaigns) {
  localStorage.setItem(CAMPAIGN_STORAGE, JSON.stringify(campaigns))
}

const PILLARS = ['Joy', 'Nostalgia', 'Love', 'Celebration', 'Healing', 'Connection']
const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'Twitter', 'LinkedIn', 'YouTube', 'Email', 'Blog']

export default function CampaignPlanner({ tasks, agents, onCreateTask }) {
  const [campaigns, setCampaigns] = useState(() => getStoredCampaigns())
  const [showForm, setShowForm] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [form, setForm] = useState({
    name: '', goal: '', startDate: '', endDate: '',
    budget: '', pillars: [], platforms: [], notes: '',
  })

  // Derive campaign stats from tasks
  const campaignStats = useMemo(() => {
    const stats = {}
    campaigns.forEach(c => {
      const cTasks = tasks.filter(t => t.campaign === c.name)
      stats[c.name] = {
        total: cTasks.length,
        done: cTasks.filter(t => t.status === 'Done').length,
        inProgress: cTasks.filter(t => t.status === 'In Progress').length,
        review: cTasks.filter(t => t.status === 'Review').length,
      }
    })
    return stats
  }, [campaigns, tasks])

  const handleCreate = () => {
    if (!form.name.trim()) return
    const campaign = {
      id: Date.now().toString(),
      ...form,
      createdAt: new Date().toISOString(),
      status: 'Planning',
    }
    const updated = [...campaigns, campaign]
    setCampaigns(updated)
    storeCampaigns(updated)
    setForm({ name: '', goal: '', startDate: '', endDate: '', budget: '', pillars: [], platforms: [], notes: '' })
    setShowForm(false)
  }

  const updateStatus = (id, status) => {
    const updated = campaigns.map(c => c.id === id ? { ...c, status } : c)
    setCampaigns(updated)
    storeCampaigns(updated)
  }

  const deleteCampaign = (id) => {
    const updated = campaigns.filter(c => c.id !== id)
    setCampaigns(updated)
    storeCampaigns(updated)
    if (selectedCampaign?.id === id) setSelectedCampaign(null)
  }

  const getProgressPercent = (name) => {
    const s = campaignStats[name]
    if (!s || s.total === 0) return 0
    return Math.round((s.done / s.total) * 100)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-gray-200">Campaign Planner</h2>
          <span className="text-xs bg-dark-600 px-2 py-0.5 rounded-full text-gray-400">{campaigns.length} campaigns</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-3 py-1.5 bg-accent-orange/20 text-accent-orange rounded-md hover:bg-accent-orange/30 transition-colors font-semibold"
        >
          + New Campaign
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="px-4 py-4 border-b border-dark-500 bg-dark-800/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text" placeholder="Campaign Name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40"
            />
            <input
              type="text" placeholder="Goal (e.g., 50k impressions)" value={form.goal}
              onChange={e => setForm({ ...form, goal: e.target.value })}
              className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40"
            />
            <input
              type="date" value={form.startDate}
              onChange={e => setForm({ ...form, startDate: e.target.value })}
              className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent-orange/40"
            />
            <input
              type="date" value={form.endDate}
              onChange={e => setForm({ ...form, endDate: e.target.value })}
              className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent-orange/40"
            />
          </div>
          <div className="mb-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Emotional Pillars</div>
            <div className="flex gap-1.5 flex-wrap">
              {PILLARS.map(p => (
                <button key={p} onClick={() => {
                  const pillars = form.pillars.includes(p) ? form.pillars.filter(x => x !== p) : [...form.pillars, p]
                  setForm({ ...form, pillars })
                }} className={`text-[10px] px-2 py-1 rounded-full transition-all ${
                  form.pillars.includes(p) ? 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30' : 'bg-dark-600 text-gray-500 border border-transparent'
                }`}>{p}</button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Platforms</div>
            <div className="flex gap-1.5 flex-wrap">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => {
                  const platforms = form.platforms.includes(p) ? form.platforms.filter(x => x !== p) : [...form.platforms, p]
                  setForm({ ...form, platforms })
                }} className={`text-[10px] px-2 py-1 rounded-full transition-all ${
                  form.platforms.includes(p) ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-dark-600 text-gray-500 border border-transparent'
                }`}>{p}</button>
              ))}
            </div>
          </div>
          <textarea
            placeholder="Campaign notes..."
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40 resize-none mb-3"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
            <button onClick={handleCreate} disabled={!form.name.trim()} className="text-xs px-4 py-1.5 bg-accent-green/20 text-accent-green rounded-md hover:bg-accent-green/30 transition-colors font-semibold disabled:opacity-30">Create Campaign</button>
          </div>
        </div>
      )}

      {/* Campaign Cards */}
      <div className="flex-1 overflow-y-auto p-4">
        {campaigns.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">{'\u{1F4CB}'}</div>
            <p className="text-sm text-gray-500">No campaigns yet</p>
            <p className="text-xs text-gray-600 mt-1">Create a campaign to organize your content strategy</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {campaigns.map(campaign => {
              const stats = campaignStats[campaign.name] || { total: 0, done: 0, inProgress: 0, review: 0 }
              const progress = getProgressPercent(campaign.name)

              return (
                <div key={campaign.id} className="bg-dark-700 rounded-lg border border-dark-500 p-4 hover:border-dark-400 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-100">{campaign.name}</h3>
                      {campaign.goal && <p className="text-[11px] text-gray-500 mt-0.5">{campaign.goal}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        value={campaign.status}
                        onChange={e => updateStatus(campaign.id, e.target.value)}
                        className="text-[9px] bg-dark-800 border border-dark-500 rounded px-1.5 py-0.5 text-gray-400 focus:outline-none"
                      >
                        <option>Planning</option>
                        <option>Active</option>
                        <option>Paused</option>
                        <option>Completed</option>
                      </select>
                      <button onClick={() => deleteCampaign(campaign.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                      <span>{stats.total} tasks</span>
                      <span className="text-accent-green">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-dark-600 rounded-full overflow-hidden">
                      <div className="h-full bg-accent-green rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-3 text-[10px] mb-3">
                    <span className="text-blue-400">{stats.inProgress} in progress</span>
                    <span className="text-orange-400">{stats.review} review</span>
                    <span className="text-green-400">{stats.done} done</span>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-[10px] text-gray-600">
                    <div className="flex gap-1.5">
                      {campaign.pillars?.map(p => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-dark-600 text-gray-500">{p}</span>
                      ))}
                    </div>
                    {campaign.startDate && (
                      <span>{new Date(campaign.startDate).toLocaleDateString()} - {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : '...'}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

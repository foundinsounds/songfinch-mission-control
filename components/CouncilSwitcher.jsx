'use client'

import { useState, useEffect } from 'react'

const ICON_OPTIONS = [
  { value: '\u{1F3AF}', label: 'Target' },
  { value: '\u{1F4C8}', label: 'Chart' },
  { value: '\u{1F4BB}', label: 'Laptop' },
  { value: '\u{1F680}', label: 'Rocket' },
  { value: '\u{1F3DB}', label: 'Building' },
  { value: '\u{1F4A1}', label: 'Lightbulb' },
  { value: '\u{1F50D}', label: 'Search' },
  { value: '\u{1F91D}', label: 'Handshake' },
  { value: '\u{2699}', label: 'Gear' },
  { value: '\u{1F3A8}', label: 'Palette' },
]

const COLOR_OPTIONS = ['#FF6B35', '#6366f1', '#22c55e', '#eab308', '#ef4444', '#3b82f6', '#a855f7', '#14b8a6', '#ec4899', '#f97316']

export default function CouncilSwitcher({ currentCouncil, onSwitchCouncil }) {
  const [councils, setCouncils] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', org: '', description: '', icon: '\u{1F3DB}', color: '#FF6B35' })

  useEffect(() => {
    fetchCouncils()
  }, [])

  async function fetchCouncils() {
    try {
      const res = await fetch('/api/councils')
      const data = await res.json()
      setCouncils(data.councils || [])
    } catch {
      setCouncils([{
        id: 'default',
        name: 'Marketing Council',
        org: 'Songfinch',
        icon: '\u{1F3AF}',
        color: '#FF6B35',
        isActive: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/councils', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to create council')
      setShowCreate(false)
      setForm({ name: '', org: '', description: '', icon: '\u{1F3DB}', color: '#FF6B35' })
      await fetchCouncils()
    } catch (err) {
      console.error('Failed to create council:', err)
    } finally {
      setCreating(false)
    }
  }

  const active = councils.find(c => c.name === currentCouncil) || councils[0] || {
    name: 'Marketing Council',
    icon: '\u{1F3AF}',
    color: '#FF6B35',
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-700 border border-dark-500 hover:border-dark-400 transition-colors"
      >
        <span className="text-sm">{active.icon}</span>
        <span className="text-[11px] font-semibold text-gray-200">{active.name}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setShowCreate(false) }} />
          <div className="absolute top-full left-0 mt-1 w-72 bg-dark-700 border border-dark-500 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-dark-500">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Switch Council</span>
            </div>
            {councils.map((council) => (
              <button
                key={council.id}
                onClick={() => {
                  if (onSwitchCouncil) onSwitchCouncil(council)
                  setIsOpen(false)
                  setShowCreate(false)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-dark-600 transition-colors text-left ${
                  council.name === currentCouncil ? 'bg-dark-600' : ''
                }`}
              >
                <span className="text-lg">{council.icon}</span>
                <div className="flex-1">
                  <div className="text-[11px] font-semibold text-gray-200">{council.name}</div>
                  <div className="text-[9px] text-gray-500">{council.org || 'Organization'}</div>
                </div>
                {council.name === currentCouncil && (
                  <span className="text-accent-green text-xs">{'\u2713'}</span>
                )}
              </button>
            ))}

            {/* Create New Council */}
            <div className="border-t border-dark-500">
              {!showCreate ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full text-[10px] text-gray-500 hover:text-gray-300 hover:bg-dark-600 transition-colors flex items-center gap-1.5 px-3 py-2"
                >
                  <span>+</span>
                  Create New Council
                </button>
              ) : (
                <div className="p-3 space-y-2.5">
                  <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">New Council</div>

                  {/* Name */}
                  <input
                    type="text"
                    placeholder="Council name..."
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full text-[11px] px-2.5 py-1.5 rounded-md bg-dark-800 border border-dark-500 text-gray-200 placeholder-gray-600 focus:border-accent-orange focus:outline-none"
                    autoFocus
                  />

                  {/* Organization */}
                  <input
                    type="text"
                    placeholder="Organization..."
                    value={form.org}
                    onChange={(e) => setForm(f => ({ ...f, org: e.target.value }))}
                    className="w-full text-[11px] px-2.5 py-1.5 rounded-md bg-dark-800 border border-dark-500 text-gray-200 placeholder-gray-600 focus:border-accent-orange focus:outline-none"
                  />

                  {/* Description */}
                  <input
                    type="text"
                    placeholder="What does this council do?"
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full text-[11px] px-2.5 py-1.5 rounded-md bg-dark-800 border border-dark-500 text-gray-200 placeholder-gray-600 focus:border-accent-orange focus:outline-none"
                  />

                  {/* Icon picker */}
                  <div>
                    <div className="text-[9px] text-gray-500 mb-1">Icon</div>
                    <div className="flex gap-1 flex-wrap">
                      {ICON_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setForm(f => ({ ...f, icon: opt.value }))}
                          className={`w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all ${
                            form.icon === opt.value
                              ? 'bg-accent-orange/20 border border-accent-orange/40'
                              : 'bg-dark-800 border border-dark-500 hover:border-dark-400'
                          }`}
                          title={opt.label}
                        >
                          {opt.value}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color picker */}
                  <div>
                    <div className="text-[9px] text-gray-500 mb-1">Color</div>
                    <div className="flex gap-1">
                      {COLOR_OPTIONS.map(c => (
                        <button
                          key={c}
                          onClick={() => setForm(f => ({ ...f, color: c }))}
                          className={`w-5 h-5 rounded-full transition-all ${
                            form.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-dark-700' : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCreate}
                      disabled={!form.name.trim() || creating}
                      className="flex-1 text-[10px] font-semibold px-3 py-1.5 rounded-md bg-accent-orange/15 text-accent-orange border border-accent-orange/25 hover:bg-accent-orange/25 transition-colors disabled:opacity-40"
                    >
                      {creating ? 'Creating...' : 'Create Council'}
                    </button>
                    <button
                      onClick={() => setShowCreate(false)}
                      className="text-[10px] px-3 py-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-dark-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

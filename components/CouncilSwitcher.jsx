'use client'

import { useState, useEffect } from 'react'

export default function CouncilSwitcher({ currentCouncil, onSwitchCouncil }) {
  const [councils, setCouncils] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCouncils() {
      try {
        const res = await fetch('/api/councils')
        const data = await res.json()
        setCouncils(data.councils || [])
      } catch {
        // Default council
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
    fetchCouncils()
  }, [])

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
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-dark-700 border border-dark-500 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-dark-500">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Switch Council</span>
            </div>
            {councils.map((council) => (
              <button
                key={council.id}
                onClick={() => {
                  if (onSwitchCouncil) onSwitchCouncil(council)
                  setIsOpen(false)
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
            <div className="px-3 py-2 border-t border-dark-500">
              <button className="w-full text-[10px] text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5 py-1">
                <span>+</span>
                Create New Council
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

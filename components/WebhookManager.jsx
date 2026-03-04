'use client'

import { useState } from 'react'

const WEBHOOK_STORAGE = 'roundtable-webhooks'

function getStoredWebhooks() {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(WEBHOOK_STORAGE) || '[]')
  } catch { return [] }
}

function storeWebhooks(hooks) {
  localStorage.setItem(WEBHOOK_STORAGE, JSON.stringify(hooks))
}

const TRIGGER_EVENTS = [
  { value: 'task.completed', label: 'Task Completed', icon: '\u2705' },
  { value: 'task.review', label: 'Task Moved to Review', icon: '\u{1F50D}' },
  { value: 'task.created', label: 'Task Created', icon: '\u2795' },
  { value: 'agent.error', label: 'Agent Error', icon: '\u274C' },
  { value: 'agent.run', label: 'Agent Run Completed', icon: '\u26A1' },
  { value: 'content.approved', label: 'Content Approved', icon: '\u{1F44D}' },
]

export default function WebhookManager() {
  const [webhooks, setWebhooks] = useState(() => getStoredWebhooks())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', events: [], secret: '' })
  const [testingId, setTestingId] = useState(null)

  const handleCreate = () => {
    if (!form.name.trim() || !form.url.trim() || form.events.length === 0) return
    const webhook = {
      id: Date.now().toString(),
      ...form,
      enabled: true,
      createdAt: new Date().toISOString(),
      lastTriggered: null,
      triggerCount: 0,
    }
    const updated = [...webhooks, webhook]
    setWebhooks(updated)
    storeWebhooks(updated)
    setForm({ name: '', url: '', events: [], secret: '' })
    setShowForm(false)
  }

  const toggleWebhook = (id) => {
    const updated = webhooks.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w)
    setWebhooks(updated)
    storeWebhooks(updated)
  }

  const deleteWebhook = (id) => {
    const updated = webhooks.filter(w => w.id !== id)
    setWebhooks(updated)
    storeWebhooks(updated)
  }

  const testWebhook = async (webhook) => {
    setTestingId(webhook.id)
    setTimeout(() => {
      const updated = webhooks.map(w => w.id === webhook.id ? {
        ...w, lastTriggered: new Date().toISOString(), triggerCount: w.triggerCount + 1
      } : w)
      setWebhooks(updated)
      storeWebhooks(updated)
      setTestingId(null)
    }, 1500)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-gray-200">Webhook Triggers</h2>
          <span className="text-xs bg-dark-600 px-2 py-0.5 rounded-full text-gray-400">{webhooks.length} webhooks</span>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="text-xs px-3 py-1.5 bg-accent-orange/20 text-accent-orange rounded-md hover:bg-accent-orange/30 transition-colors font-semibold">
          + New Webhook
        </button>
      </div>

      {showForm && (
        <div className="px-4 py-4 border-b border-dark-500 bg-dark-800/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input type="text" placeholder="Webhook Name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40" />
            <input type="url" placeholder="https://hooks.example.com/webhook" value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40 font-mono" />
          </div>
          <div className="mb-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Trigger Events</div>
            <div className="flex gap-1.5 flex-wrap">
              {TRIGGER_EVENTS.map(ev => (
                <button key={ev.value} onClick={() => {
                  const events = form.events.includes(ev.value) ? form.events.filter(e => e !== ev.value) : [...form.events, ev.value]
                  setForm({ ...form, events })
                }} className={`text-[10px] px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                  form.events.includes(ev.value) ? 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30' : 'bg-dark-600 text-gray-500 border border-transparent'
                }`}>{ev.icon} {ev.label}</button>
              ))}
            </div>
          </div>
          <input type="text" placeholder="Signing Secret (optional)" value={form.secret}
            onChange={e => setForm({ ...form, secret: e.target.value })}
            className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40 font-mono mb-3" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
            <button onClick={handleCreate} disabled={!form.name.trim() || !form.url.trim() || form.events.length === 0}
              className="text-xs px-4 py-1.5 bg-accent-green/20 text-accent-green rounded-md hover:bg-accent-green/30 transition-colors font-semibold disabled:opacity-30">
              Create Webhook
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {webhooks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">{'\u{1F517}'}</div>
            <p className="text-sm text-gray-500">No webhooks configured</p>
            <p className="text-xs text-gray-600 mt-1">Create webhooks to trigger external actions on events</p>
          </div>
        ) : (
          webhooks.map(webhook => (
            <div key={webhook.id} className="bg-dark-700 rounded-lg border border-dark-500 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${webhook.enabled ? 'bg-accent-green' : 'bg-gray-500'}`} />
                  <h3 className="text-sm font-semibold text-gray-100">{webhook.name}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => testWebhook(webhook)}
                    className={`text-[10px] px-2 py-1 rounded bg-dark-600 text-gray-400 hover:text-gray-200 transition-colors ${testingId === webhook.id ? 'animate-pulse' : ''}`}>
                    {testingId === webhook.id ? 'Testing...' : 'Test'}
                  </button>
                  <button onClick={() => toggleWebhook(webhook.id)}
                    className={`text-[10px] px-2 py-1 rounded transition-colors ${webhook.enabled ? 'bg-green-500/10 text-green-400' : 'bg-dark-600 text-gray-500'}`}>
                    {webhook.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button onClick={() => deleteWebhook(webhook.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-gray-500 font-mono mb-2 truncate">{webhook.url}</div>
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {webhook.events.map(ev => {
                  const event = TRIGGER_EVENTS.find(e => e.value === ev)
                  return (
                    <span key={ev} className="text-[9px] px-1.5 py-0.5 rounded bg-dark-600 text-gray-400">
                      {event?.icon} {event?.label || ev}
                    </span>
                  )
                })}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-600">
                <span>{webhook.triggerCount} triggers</span>
                {webhook.lastTriggered && <span>Last: {new Date(webhook.lastTriggered).toLocaleString()}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { APP_NAME, VERSION, COUNCIL_NAME, COUNCIL_ORG, MODEL_OPTIONS, DEFAULT_MODEL } from '../lib/constants'

export default function SettingsPanel({ theme, onToggleTheme, onClose }) {
  const [activeTab, setActiveTab] = useState('general')

  // Settings state (persisted in localStorage)
  const [settings, setSettings] = useState(() => {
    if (typeof window === 'undefined') return getDefaults()
    try {
      const saved = localStorage.getItem('roundtable-settings')
      return saved ? { ...getDefaults(), ...JSON.parse(saved) } : getDefaults()
    } catch { return getDefaults() }
  })

  function getDefaults() {
    return {
      autoRunAgents: false,
      runInterval: 60,
      pollInterval: 15,
      showNotifications: true,
      soundEnabled: true,
      soundVolume: 50,
      soundOnTaskComplete: true,
      soundOnAgentFinish: true,
      soundOnError: true,
      soundOnMention: false,
      compactMode: false,
      defaultModel: DEFAULT_MODEL,
      liveFeedMaxItems: 50,
    }
  }

  const updateSetting = (key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem('roundtable-settings', JSON.stringify(next))
        window.dispatchEvent(new Event('roundtable-settings-changed'))
      } catch {}
      return next
    })
  }

  const tabs = [
    { key: 'general', label: 'General' },
    { key: 'agents', label: 'Agents' },
    { key: 'council', label: 'Council' },
    { key: 'about', label: 'About' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      <div
        className="settings-panel relative w-full max-w-lg mx-4 rounded-xl border border-dark-500 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-500">
          <div>
            <h2 className="text-lg font-bold">Settings</h2>
            <p className="text-[11px] text-gray-500">{APP_NAME} configuration</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-600 transition-colors text-gray-400 hover:text-gray-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-500 px-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-[12px] font-medium transition-all border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-accent-orange text-accent-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[400px] overflow-y-auto space-y-5">
          {activeTab === 'general' && (
            <>
              {/* Appearance */}
              <SettingGroup title="Appearance">
                <SettingRow
                  label="Theme"
                  description="Switch between dark and light mode"
                >
                  <button
                    onClick={onToggleTheme}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all"
                    style={{
                      background: 'var(--bg-hover)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    {theme === 'dark' ? 'Dark' : 'Light'}
                  </button>
                </SettingRow>
                <SettingRow
                  label="Compact mode"
                  description="Reduce spacing for more content density"
                >
                  <Toggle
                    checked={settings.compactMode}
                    onChange={(v) => updateSetting('compactMode', v)}
                  />
                </SettingRow>
              </SettingGroup>

              {/* Data */}
              <SettingGroup title="Data & Sync">
                <SettingRow
                  label="Poll interval"
                  description="How often to refresh data from Airtable"
                >
                  <select
                    value={settings.pollInterval}
                    onChange={(e) => updateSetting('pollInterval', Number(e.target.value))}
                    className="text-[11px] px-2 py-1 rounded-md border"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                  </select>
                </SettingRow>
                <SettingRow
                  label="Live Feed max items"
                  description="Maximum number of events to display"
                >
                  <select
                    value={settings.liveFeedMaxItems}
                    onChange={(e) => updateSetting('liveFeedMaxItems', Number(e.target.value))}
                    className="text-[11px] px-2 py-1 rounded-md border"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </SettingRow>
                <SettingRow
                  label="Notifications"
                  description="Show browser notifications for agent activity"
                >
                  <Toggle
                    checked={settings.showNotifications}
                    onChange={(v) => updateSetting('showNotifications', v)}
                  />
                </SettingRow>
              </SettingGroup>

              {/* Sound Preferences */}
              <SettingGroup title="Sound & Alerts">
                <SettingRow
                  label="Sound effects"
                  description="Play audio cues for events"
                >
                  <Toggle
                    checked={settings.soundEnabled}
                    onChange={(v) => updateSetting('soundEnabled', v)}
                  />
                </SettingRow>
                {settings.soundEnabled && (
                  <>
                    <SettingRow
                      label="Volume"
                      description="Audio alert volume level"
                    >
                      <div className="flex items-center gap-2">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 shrink-0">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        </svg>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={10}
                          value={settings.soundVolume}
                          onChange={(e) => updateSetting('soundVolume', Number(e.target.value))}
                          className="w-20 h-1 accent-accent-orange cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-500 font-mono tabular-nums w-7 text-right">{settings.soundVolume}%</span>
                      </div>
                    </SettingRow>
                    <div className="text-[10px] text-gray-600 font-medium uppercase tracking-wider mb-1.5 mt-2">Play sound when:</div>
                    <SettingRow label="Task completed" description="A task moves to Done">
                      <Toggle checked={settings.soundOnTaskComplete} onChange={(v) => updateSetting('soundOnTaskComplete', v)} />
                    </SettingRow>
                    <SettingRow label="Agent finished" description="An agent completes its run">
                      <Toggle checked={settings.soundOnAgentFinish} onChange={(v) => updateSetting('soundOnAgentFinish', v)} />
                    </SettingRow>
                    <SettingRow label="Error alert" description="An error or failure occurs">
                      <Toggle checked={settings.soundOnError} onChange={(v) => updateSetting('soundOnError', v)} />
                    </SettingRow>
                    <SettingRow label="Mentions" description="When @mentioned in a comment">
                      <Toggle checked={settings.soundOnMention} onChange={(v) => updateSetting('soundOnMention', v)} />
                    </SettingRow>
                  </>
                )}
              </SettingGroup>
            </>
          )}

          {activeTab === 'agents' && (
            <>
              <SettingGroup title="Agent Runner">
                <SettingRow
                  label="Auto-run agents"
                  description="Automatically trigger agents on a schedule"
                >
                  <Toggle
                    checked={settings.autoRunAgents}
                    onChange={(v) => updateSetting('autoRunAgents', v)}
                  />
                </SettingRow>
                <SettingRow
                  label="Run interval"
                  description="How often to trigger automatic agent runs"
                >
                  <select
                    value={settings.runInterval}
                    onChange={(e) => updateSetting('runInterval', Number(e.target.value))}
                    className="text-[11px] px-2 py-1 rounded-md border"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value={15}>Every 15 min</option>
                    <option value={30}>Every 30 min</option>
                    <option value={60}>Every hour</option>
                    <option value={360}>Every 6 hours</option>
                  </select>
                </SettingRow>
                <SettingRow
                  label="Default model"
                  description="Default AI model for new agents"
                >
                  <select
                    value={settings.defaultModel}
                    onChange={(e) => updateSetting('defaultModel', e.target.value)}
                    className="text-[11px] px-2 py-1 rounded-md border"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    {MODEL_OPTIONS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </SettingRow>
              </SettingGroup>
            </>
          )}

          {activeTab === 'council' && (
            <>
              <SettingGroup title="Active Council">
                <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-orange/10 border border-accent-orange/20 flex items-center justify-center text-lg">
                      <span>&#9876;</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{COUNCIL_NAME}</div>
                      <div className="text-[11px] text-gray-500">{COUNCIL_ORG}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-md" style={{ background: 'var(--bg-primary)' }}>
                      <div className="text-lg font-bold">9</div>
                      <div className="text-[10px] text-gray-500">Agents</div>
                    </div>
                    <div className="p-2 rounded-md" style={{ background: 'var(--bg-primary)' }}>
                      <div className="text-lg font-bold text-accent-orange">15</div>
                      <div className="text-[10px] text-gray-500">Tasks</div>
                    </div>
                    <div className="p-2 rounded-md" style={{ background: 'var(--bg-primary)' }}>
                      <div className="text-lg font-bold text-accent-green">472</div>
                      <div className="text-[10px] text-gray-500">Completed</div>
                    </div>
                  </div>
                </div>
              </SettingGroup>

              <SettingGroup title="Councils (coming soon)">
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Create multiple Councils for different teams. Each Council has its own agents, tasks, and workflows. Councils can eventually collaborate and share intelligence.
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg border opacity-50" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}>
                    <span className="text-lg">&#128200;</span>
                    <div>
                      <div className="text-[12px] font-medium">Sales Council</div>
                      <div className="text-[10px] text-gray-500">Lead gen, outreach, CRM automation</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border opacity-50" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}>
                    <span className="text-lg">&#128187;</span>
                    <div>
                      <div className="text-[12px] font-medium">Product Council</div>
                      <div className="text-[10px] text-gray-500">Roadmap, specs, user research</div>
                    </div>
                  </div>
                </div>
              </SettingGroup>
            </>
          )}

          {activeTab === 'about' && (
            <>
              <SettingGroup title="Roundtable">
                <div className="text-center py-4">
                  <div className="text-2xl font-bold mb-1">{APP_NAME}</div>
                  <div className="text-[12px] text-gray-500 italic mb-3">where AI plans</div>
                  <div className="text-[11px] text-gray-600">{VERSION}</div>
                </div>
                <div className="text-[12px] text-gray-500 leading-relaxed">
                  Roundtable is a multi-team AI orchestration platform. Create Councils — teams of AI agents that plan, create, and execute autonomously. Each Council operates like a department with its own hierarchy, goals, and workflows.
                </div>
              </SettingGroup>

              <SettingGroup title="API Keys">
                <SettingRow label="Anthropic" description="Claude API">
                  <span className="text-[11px] text-accent-green font-medium">Connected</span>
                </SettingRow>
                <SettingRow label="OpenAI" description="GPT API">
                  <span className="text-[11px] text-accent-green font-medium">Connected</span>
                </SettingRow>
                <SettingRow label="Google AI" description="Gemini API">
                  <span className="text-[11px] text-accent-green font-medium">Connected</span>
                </SettingRow>
                <SettingRow label="Airtable" description="Database">
                  <span className="text-[11px] text-accent-green font-medium">Connected</span>
                </SettingRow>
              </SettingGroup>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// -- Helper Components --

function SettingGroup({ title, children }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {description && <div className="text-[11px] text-gray-500">{description}</div>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        checked ? 'bg-accent-green' : 'bg-gray-600'
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

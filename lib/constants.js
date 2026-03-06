// Roundtable — where AI plans

export const APP_NAME = 'ROUNDTABLE'
export const APP_TAGLINE = 'where AI plans'

// Current Council (team/project)
export const COUNCIL_NAME = 'Marketing Council'
export const COUNCIL_ORG = 'Songfinch'

export const GOOGLE_DRIVE_FOLDER = "https://drive.google.com/drive/folders/1x9BK_usoOu2aAXBtQSxUgD_2-o3Oqiyk"

export const AIRTABLE_BASE_URL = "https://airtable.com/appZ5IalDyQfyYHGS"

export const DEFAULT_MODEL = 'claude-sonnet-4-6'

export const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Default)', provider: 'Anthropic' },
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'Anthropic' },
  { value: 'claude-3-opus', label: 'Claude Opus 4', provider: 'Anthropic' },
  { value: 'claude-3.5-haiku', label: 'Claude Haiku 3.5', provider: 'Anthropic' },
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'Google' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Google' },
]

// Legacy model value mapping — old Airtable values → current MODEL_OPTIONS values
export const MODEL_LEGACY_MAP = {
  'claude-3.5-sonnet': 'claude-sonnet-4-6',
  'claude-3-haiku': 'claude-3.5-haiku',
}

// Cron runs hourly at :00 — used for countdown timer
export const CRON_INTERVAL_MINUTES = 60

export const AGENT_STATUSES = ['Active', 'Working', 'Idle']

// ── TASK STATUS STYLES ──────────────────────────
// Single source of truth for all task status colors across the dashboard.
// Components should import from here instead of defining their own copies.
//   hex   → inline style (charts, progress bars)
//   dot   → Tailwind class for status dots
//   text  → Tailwind class for text color
//   badge → Tailwind classes for status badge pill (bg + text + border)
export const STATUS_STYLES = {
  'Inbox':       { hex: '#6b7280', dot: 'bg-gray-500',      text: 'text-gray-400',   badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  'Assigned':    { hex: '#eab308', dot: 'bg-accent-yellow', text: 'text-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  'In Progress': { hex: '#3b82f6', dot: 'bg-accent-blue',   text: 'text-blue-400',   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  'Review':      { hex: '#f97316', dot: 'bg-accent-orange', text: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  'Done':        { hex: '#22c55e', dot: 'bg-accent-green',  text: 'text-green-400',  badge: 'bg-green-500/10 text-green-400 border-green-500/20' },
}

// Convenience helpers for components that only need one format
export const STATUS_HEX = Object.fromEntries(Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.hex]))
export const STATUS_BADGE = Object.fromEntries(Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.badge]))

export const VERSION = 'v4.0'

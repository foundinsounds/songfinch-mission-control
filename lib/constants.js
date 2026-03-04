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

export const VERSION = 'v4.0'

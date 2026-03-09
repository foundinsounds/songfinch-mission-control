// Runtime System Configuration
// Uses Vercel Blob to persist pause state across serverless invocations.
// Falls back to env var SYSTEM_PAUSED if Blob is unavailable.

const CONFIG_KEY = 'system-config.json'
const DEFAULT_CONFIG = {
  paused: false,
  pausedAt: null,
  pausedBy: null,
  cronsEnabled: false,  // Crons are disabled in vercel.json — must re-enable there to restore
  reason: null,
  // Budget cap — daily API call limits
  dailyBudget: 50,       // Max AI API calls per day (0 = unlimited)
  todayCalls: 0,         // Counter for today's calls
  todayDate: null,       // ISO date string (YYYY-MM-DD) for resetting counter
  totalCallsAllTime: 0,  // Lifetime counter for analytics
}

// In-memory cache with TTL to avoid reading Blob on every request
let _cache = null
let _cacheTime = 0
const CACHE_TTL = 10_000 // 10 seconds

async function getBlobModule() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return null
    return await import('@vercel/blob')
  } catch {
    return null
  }
}

/**
 * Read the current system config.
 * Priority: Blob store → env var fallback → defaults
 */
export async function getSystemConfig() {
  // Return cached if fresh
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
    return _cache
  }

  const blob = await getBlobModule()
  if (blob) {
    try {
      const { list } = blob
      const { blobs } = await list({ prefix: CONFIG_KEY })
      if (blobs.length > 0) {
        const res = await fetch(blobs[0].url)
        const config = await res.json()
        _cache = { ...DEFAULT_CONFIG, ...config }
        _cacheTime = Date.now()
        return _cache
      }
    } catch (err) {
      console.warn('[CONFIG] Blob read failed, using fallback:', err.message)
    }
  }

  // Fallback to env var
  const config = {
    ...DEFAULT_CONFIG,
    paused: process.env.SYSTEM_PAUSED === 'true',
  }
  _cache = config
  _cacheTime = Date.now()
  return config
}

/**
 * Update the system config (merge with existing).
 * Returns the updated config.
 */
export async function updateSystemConfig(updates) {
  const current = await getSystemConfig()
  const updated = { ...current, ...updates, updatedAt: new Date().toISOString() }

  const blob = await getBlobModule()
  if (blob) {
    try {
      const { put } = blob
      await put(CONFIG_KEY, JSON.stringify(updated, null, 2), {
        access: 'public',
        addRandomSuffix: false,
      })
    } catch (err) {
      console.error('[CONFIG] Blob write failed:', err.message)
      throw new Error('Failed to save system config: ' + err.message)
    }
  } else {
    console.warn('[CONFIG] No Blob store available — config change is ephemeral')
  }

  // Update cache immediately
  _cache = updated
  _cacheTime = Date.now()
  return updated
}

/**
 * Quick check: is the system paused?
 * Used by cron endpoints and chat API to bail early.
 */
export async function isSystemPaused() {
  const config = await getSystemConfig()
  return config.paused
}

/**
 * Get today's date as YYYY-MM-DD in local timezone.
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Check budget and return { allowed, remaining, used, limit, autoPaused }.
 * If budget is exceeded, auto-pauses the system.
 */
export async function checkBudget() {
  const config = await getSystemConfig()
  const today = getTodayDate()

  // Reset counter if it's a new day
  let todayCalls = config.todayCalls || 0
  if (config.todayDate !== today) {
    todayCalls = 0
  }

  const limit = config.dailyBudget || 0
  if (limit === 0) {
    // Unlimited
    return { allowed: true, remaining: Infinity, used: todayCalls, limit: 0, autoPaused: false }
  }

  const remaining = Math.max(0, limit - todayCalls)
  const exceeded = todayCalls >= limit

  // Auto-pause if budget exceeded
  if (exceeded && !config.paused) {
    await updateSystemConfig({
      paused: true,
      pausedAt: new Date().toISOString(),
      pausedBy: 'budget-cap',
      reason: `Daily budget of ${limit} API calls reached (${todayCalls} used)`,
    })
    return { allowed: false, remaining: 0, used: todayCalls, limit, autoPaused: true }
  }

  return { allowed: !exceeded && !config.paused, remaining, used: todayCalls, limit, autoPaused: false }
}

/**
 * Increment the daily API call counter.
 * Called after each successful AI API call.
 */
export async function trackApiCall() {
  const config = await getSystemConfig()
  const today = getTodayDate()

  // Reset counter on new day
  const todayCalls = config.todayDate === today ? (config.todayCalls || 0) + 1 : 1
  const totalCallsAllTime = (config.totalCallsAllTime || 0) + 1

  await updateSystemConfig({
    todayCalls,
    todayDate: today,
    totalCallsAllTime,
  })

  return { todayCalls, totalCallsAllTime }
}

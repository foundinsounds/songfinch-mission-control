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

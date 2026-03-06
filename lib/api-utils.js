// Shared API route utilities — input validation, error handling, safe JSON parsing

import { NextResponse } from 'next/server'

/**
 * Safely parse JSON from a request body.
 * Returns { data, error } — callers check error to return 400 early.
 *
 * Usage:
 *   const { data: body, error } = await safeJsonParse(request)
 *   if (error) return error   // error is already a NextResponse(400)
 */
export async function safeJsonParse(request) {
  try {
    const data = await request.json()
    if (data === null || typeof data !== 'object') {
      return { data: null, error: NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 }) }
    }
    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Invalid JSON in request body', details: err.message },
        { status: 400 }
      ),
    }
  }
}

/**
 * Validate that required fields exist in the request body.
 * Returns a 400 NextResponse if any are missing, or null if all present.
 *
 * Usage:
 *   const missing = validateRequired(body, ['name', 'recordId'])
 *   if (missing) return missing
 */
export function validateRequired(body, fields) {
  const missing = fields.filter(f => body[f] === undefined || body[f] === null || body[f] === '')
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(', ')}` },
      { status: 400 }
    )
  }
  return null
}

/**
 * Standard error response with consistent format and logging.
 */
export function apiError(label, err, status = 500) {
  console.error(`[${label}] Error:`, err.message || err)
  return NextResponse.json(
    { error: err.message || 'Internal server error' },
    { status }
  )
}

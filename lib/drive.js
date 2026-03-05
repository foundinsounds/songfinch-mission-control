// Google Drive API Client for Songfinch Agent Pipeline
// Exports generated content to Google Drive alongside Airtable
// Uses Google Service Account auth (JWT-based, zero npm dependencies)
// Called by: cron pipeline, manual export endpoint, dashboard actions

import crypto from 'crypto'

// ---- CONFIG ----

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || ''
const SERVICE_ACCOUNT_KEY_B64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || ''

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

// Token cache — reuse until expiry
let cachedToken = null
let tokenExpiry = 0

// Content type → subfolder name mapping
const CONTENT_FOLDERS = {
  'Ad Copy': 'Ad Copy',
  'Social Post': 'Social Posts',
  'Blog Post': 'Blog Posts',
  'Video Script': 'Video Scripts',
  'Image': 'Images',
  'Video': 'Videos',
  'Landing Page': 'Landing Pages',
  'SEO Content': 'SEO Content',
  'Strategy': 'Strategy',
  'Research': 'Research',
  'Artist Spotlight': 'Artist Spotlights',
  'Report': 'Reports',
  'Email': 'Emails',
  'Design': 'Designs',
}

// Subfolder ID cache — avoids re-querying Drive for known folders
const subfolderCache = {}

// ---- JWT + AUTH ----

/**
 * Parse the service account key from base64-encoded env var.
 */
function getServiceAccountKey() {
  if (!SERVICE_ACCOUNT_KEY_B64) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured — Google Drive export unavailable')
  }

  try {
    const json = Buffer.from(SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf-8')
    return JSON.parse(json)
  } catch {
    // Try as raw JSON (in case user pasted unencoded)
    try {
      return JSON.parse(SERVICE_ACCOUNT_KEY_B64)
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is invalid — must be base64-encoded service account JSON')
    }
  }
}

/**
 * Create a signed JWT for Google service account authentication.
 * Uses Node.js built-in crypto — zero external dependencies.
 */
function createJWT(serviceAccount) {
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: serviceAccount.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600, // 1 hour
  }

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url')
  const claimB64 = Buffer.from(JSON.stringify(claim)).toString('base64url')
  const signInput = `${headerB64}.${claimB64}`

  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signInput)
  const signature = sign.sign(serviceAccount.private_key, 'base64url')

  return `${signInput}.${signature}`
}

/**
 * Get a valid access token for Google APIs.
 * Caches tokens and refreshes 5 minutes before expiry.
 */
async function getAccessToken() {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < tokenExpiry - 300000) {
    return cachedToken
  }

  const serviceAccount = getServiceAccountKey()
  const jwt = createJWT(serviceAccount)

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google auth failed: ${res.status} - ${err}`)
  }

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000)

  console.log(`[DRIVE] Authenticated as ${serviceAccount.client_email}`)
  return cachedToken
}

// ---- FOLDER MANAGEMENT ----

/**
 * Find or create a subfolder inside the root KING CLAUDE folder.
 * Caches folder IDs to avoid redundant API calls.
 */
async function getOrCreateSubfolder(name, parentId) {
  const cacheKey = `${parentId}::${name}`
  if (subfolderCache[cacheKey]) return subfolderCache[cacheKey]

  const token = await getAccessToken()

  // Search for existing folder
  const query = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (searchRes.ok) {
    const searchData = await searchRes.json()
    if (searchData.files?.length > 0) {
      subfolderCache[cacheKey] = searchData.files[0].id
      return searchData.files[0].id
    }
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Drive folder creation failed: ${createRes.status} - ${err}`)
  }

  const folder = await createRes.json()
  subfolderCache[cacheKey] = folder.id
  console.log(`[DRIVE] Created subfolder: ${name} (${folder.id})`)
  return folder.id
}

/**
 * Get the target folder ID for a given content type.
 * Creates: KING CLAUDE / {ContentType} / {CampaignName} (optional)
 */
async function getTargetFolder(contentType, campaign) {
  if (!DRIVE_FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured')
  }

  // Get or create content-type subfolder
  const folderName = CONTENT_FOLDERS[contentType] || 'Other'
  const typeFolderId = await getOrCreateSubfolder(folderName, DRIVE_FOLDER_ID)

  // If campaign specified, create a campaign subfolder
  if (campaign) {
    return await getOrCreateSubfolder(campaign, typeFolderId)
  }

  return typeFolderId
}

// ---- FILE OPERATIONS ----

/**
 * Upload a text file (Google Doc) to Google Drive.
 * Converts plain text to a Google Doc for easy editing.
 */
export async function uploadTextAsDoc({ title, content, contentType, campaign, agent }) {
  const token = await getAccessToken()
  const folderId = await getTargetFolder(contentType, campaign)

  // Format the document content
  const docContent = formatDocContent(title, content, contentType, agent)

  // Create as Google Doc using multipart upload
  const boundary = '-------314159265358979323846'
  const metadata = {
    name: title,
    mimeType: 'application/vnd.google-apps.document',
    parents: [folderId],
    description: `Generated by ${agent || 'King Claude'} | Type: ${contentType} | Campaign: ${campaign || 'N/A'}`,
  }

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    docContent,
    `--${boundary}--`,
  ].join('\r\n')

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink,mimeType`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Drive upload failed: ${res.status} - ${err}`)
  }

  const file = await res.json()
  console.log(`[DRIVE] Uploaded doc: "${title}" → ${file.webViewLink}`)

  return {
    fileId: file.id,
    fileName: file.name,
    url: file.webViewLink,
    mimeType: file.mimeType,
    folderId,
  }
}

/**
 * Upload an image file to Google Drive from a URL.
 * Downloads the image first, then uploads to Drive.
 */
export async function uploadImageFromUrl({ title, imageUrl, contentType, campaign, agent }) {
  const token = await getAccessToken()
  const folderId = await getTargetFolder(contentType || 'Image', campaign)

  // Download the image
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) {
    throw new Error(`Failed to download image from ${imageUrl}: ${imageRes.status}`)
  }

  const imageBuffer = await imageRes.arrayBuffer()
  const imageMime = imageRes.headers.get('content-type') || 'image/png'
  const ext = imageMime.includes('jpeg') ? '.jpg' : imageMime.includes('webp') ? '.webp' : '.png'

  // Upload to Drive
  const boundary = '-------314159265358979323846'
  const metadata = {
    name: `${title}${ext}`,
    parents: [folderId],
    description: `Generated by ${agent || 'PIXEL'} via DALL-E 3 | Campaign: ${campaign || 'N/A'}`,
  }

  const metaPart = JSON.stringify(metadata)
  const metaBytes = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaPart}\r\n--${boundary}\r\nContent-Type: ${imageMime}\r\n\r\n`
  )
  const endBytes = Buffer.from(`\r\n--${boundary}--`)
  const bodyBuffer = Buffer.concat([metaBytes, Buffer.from(imageBuffer), endBytes])

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink,mimeType`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: bodyBuffer,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Drive image upload failed: ${res.status} - ${err}`)
  }

  const file = await res.json()
  console.log(`[DRIVE] Uploaded image: "${title}" → ${file.webViewLink}`)

  return {
    fileId: file.id,
    fileName: file.name,
    url: file.webViewLink,
    thumbnailUrl: file.thumbnailLink,
    mimeType: file.mimeType,
    folderId,
  }
}

/**
 * Upload a video URL reference to Google Drive as a text file.
 * (Full video upload requires resumable uploads for large files)
 */
export async function uploadVideoReference({ title, videoUrl, prompt, contentType, campaign, agent }) {
  const content = [
    `Video: ${title}`,
    `Generated by: ${agent || 'LENS'} via LTX-2`,
    `Campaign: ${campaign || 'N/A'}`,
    '',
    `Video URL: ${videoUrl}`,
    '',
    `Prompt: ${prompt || 'N/A'}`,
    '',
    `Generated: ${new Date().toISOString()}`,
  ].join('\n')

  return uploadTextAsDoc({
    title: `[Video] ${title}`,
    content,
    contentType: contentType || 'Video',
    campaign,
    agent,
  })
}

// ---- CONTENT FORMATTING ----

/**
 * Format content for Google Doc upload.
 * Adds metadata header and clean formatting.
 */
function formatDocContent(title, rawContent, contentType, agent) {
  const header = [
    title,
    '═'.repeat(Math.min(title.length, 60)),
    '',
    `Content Type: ${contentType || 'General'}`,
    `Agent: ${agent || 'King Claude'}`,
    `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`,
    '',
    '─'.repeat(60),
    '',
  ].join('\n')

  // Strip any IMAGE GENERATED / VIDEO GENERATED metadata prefixes for cleaner docs
  let cleanContent = rawContent
  if (rawContent.startsWith('IMAGE GENERATED')) {
    cleanContent = rawContent.replace(/^IMAGE GENERATED\n\n/, '')
  } else if (rawContent.startsWith('VIDEO GENERATED')) {
    cleanContent = rawContent.replace(/^VIDEO GENERATED\n\n/, '')
  }

  return header + cleanContent
}

// ---- MAIN EXPORT FUNCTION ----

/**
 * Export a completed task's output to Google Drive.
 * Auto-detects content type and routes to appropriate upload method.
 *
 * @param {Object} task - Task object from Airtable
 * @param {string} task.name     - Task name (used as file title)
 * @param {string} task.output   - Generated content output
 * @param {string} task.contentType - Content type for folder routing
 * @param {string} task.campaign - Campaign name for subfolder
 * @param {string} task.agent    - Agent that generated the content
 * @returns {{ url: string, fileId: string, fileName: string }}
 */
export async function exportToDrive(task) {
  if (!isDriveConfigured()) {
    console.warn('[DRIVE] Skipping export — Drive not configured')
    return null
  }

  const { name, output, contentType, campaign, agent } = task

  try {
    // Route by content type
    if (contentType === 'Image' && output) {
      // Extract image URL from output
      const urlMatch = output.match(/URL:\s*(https?:\/\/[^\s\n]+)/i)
      if (urlMatch) {
        const result = await uploadImageFromUrl({
          title: name,
          imageUrl: urlMatch[1],
          contentType,
          campaign,
          agent,
        })
        return result
      }
    }

    if ((contentType === 'Video' || contentType === 'Video Script') && output) {
      // Extract video URL from output
      const urlMatch = output.match(/URL:\s*(https?:\/\/[^\s\n]+)/i)
      if (urlMatch) {
        const promptMatch = output.match(/Prompt:\s*(.+?)(?:\n|$)/i)
        const result = await uploadVideoReference({
          title: name,
          videoUrl: urlMatch[1],
          prompt: promptMatch?.[1] || '',
          contentType,
          campaign,
          agent,
        })
        return result
      }
    }

    // Default: upload as Google Doc
    const result = await uploadTextAsDoc({
      title: name,
      content: output || '(No output)',
      contentType: contentType || 'General',
      campaign,
      agent,
    })
    return result

  } catch (err) {
    console.error(`[DRIVE] Export failed for "${name}": ${err.message}`)
    throw err
  }
}

// ---- HELPERS ----

/**
 * Check if Google Drive is configured and ready.
 */
export function isDriveConfigured() {
  return !!(SERVICE_ACCOUNT_KEY_B64 && DRIVE_FOLDER_ID)
}

/**
 * Get Drive configuration status for health checks.
 */
export function getDriveStatus() {
  if (!SERVICE_ACCOUNT_KEY_B64) return { configured: false, reason: 'GOOGLE_SERVICE_ACCOUNT_KEY not set' }
  if (!DRIVE_FOLDER_ID) return { configured: false, reason: 'GOOGLE_DRIVE_FOLDER_ID not set' }

  try {
    const key = getServiceAccountKey()
    return {
      configured: true,
      serviceAccount: key.client_email,
      folderId: DRIVE_FOLDER_ID,
    }
  } catch (err) {
    return { configured: false, reason: err.message }
  }
}

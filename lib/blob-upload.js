// Image Upload — converts base64 data URLs to permanent HTTP URLs
// Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set
// Falls back to returning the original data URL if Blob is not configured

let blobModule = null

async function getBlobModule() {
  if (blobModule) return blobModule
  try {
    blobModule = await import('@vercel/blob')
    return blobModule
  } catch {
    return null
  }
}

/**
 * Upload a base64 data URL image and return a permanent HTTP URL.
 * If Vercel Blob is not configured, returns the original data URL unchanged.
 */
export async function uploadImage(dataUrl, filename = 'image.jpg') {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl // Already an HTTP URL or empty
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('[BLOB] BLOB_READ_WRITE_TOKEN not set — returning base64 data URL')
    return dataUrl
  }

  try {
    const blob = await getBlobModule()
    if (!blob) {
      console.warn('[BLOB] @vercel/blob not available')
      return dataUrl
    }

    // Parse base64 data URL
    const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
    if (!match) return dataUrl

    const mimeType = match[1]
    const buffer = Buffer.from(match[2], 'base64')
    const ext = mimeType.includes('jpeg') ? '.jpg' : mimeType.includes('webp') ? '.webp' : '.png'
    const name = filename.replace(/\.[^.]+$/, '') + ext

    const { url } = await blob.put(name, buffer, {
      access: 'public',
      contentType: mimeType,
    })

    console.log(`[BLOB] Uploaded: ${name} (${Math.round(buffer.length / 1024)}KB) → ${url}`)
    return url
  } catch (err) {
    console.warn(`[BLOB] Upload failed: ${err.message} — returning data URL`)
    return dataUrl
  }
}

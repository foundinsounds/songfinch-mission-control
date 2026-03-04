// Figma API — Pull design context for landing page tasks
// GET /api/figma?url=<figma_url>

import { buildDesignContext, isFigmaConfigured, parseFigmaUrl, getFileInfo, getStyles, getComponents } from '../../../lib/figma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (!isFigmaConfigured()) {
    return NextResponse.json({ error: 'FIGMA_TOKEN not configured' }, { status: 503 })
  }

  const url = new URL(request.url)
  const figmaUrl = url.searchParams.get('url')

  if (!figmaUrl) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
  }

  const parsed = parseFigmaUrl(figmaUrl)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Figma URL' }, { status: 400 })
  }

  try {
    const context = await buildDesignContext(figmaUrl)
    const fileInfo = await getFileInfo(parsed.fileKey)

    let styles = []
    let components = []
    try { styles = await getStyles(parsed.fileKey) } catch {}
    try { components = await getComponents(parsed.fileKey) } catch {}

    return NextResponse.json({
      context,
      file: fileInfo,
      styles,
      components: components.slice(0, 50),
      nodeId: parsed.nodeId,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

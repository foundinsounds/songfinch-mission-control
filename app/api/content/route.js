import { getContentLibrary } from '../../../lib/airtable'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const content = await getContentLibrary()
    return NextResponse.json({ content })
  } catch (err) {
    console.error('Content API error:', err)
    return NextResponse.json({ error: err.message, content: [] }, { status: 500 })
  }
}

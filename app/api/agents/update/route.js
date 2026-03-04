import { updateAgent } from '../../../../lib/airtable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    const { recordId, fields } = body

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId is required' },
        { status: 400 }
      )
    }

    if (!fields || Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: 'fields object is required and must not be empty' },
        { status: 400 }
      )
    }

    // Map frontend field names to Airtable field names
    const airtableFields = {}
    if (fields.status !== undefined) airtableFields['Status'] = fields.status
    if (fields.model !== undefined) airtableFields['Model'] = fields.model
    if (fields.temperature !== undefined) airtableFields['Temperature'] = fields.temperature
    if (fields.systemPrompt !== undefined) airtableFields['System Prompt'] = fields.systemPrompt

    const result = await updateAgent(recordId, airtableFields)

    return NextResponse.json({
      success: true,
      record: result,
    })
  } catch (error) {
    console.error('Agent update error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

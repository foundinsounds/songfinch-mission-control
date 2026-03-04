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
    // Only include fields that have values to avoid Airtable errors with undefined
    const airtableFields = {}
    if (fields.status !== undefined && fields.status !== null) {
      airtableFields['Status'] = fields.status
    }
    if (fields.model !== undefined && fields.model !== null) {
      airtableFields['Model'] = fields.model
    }
    if (fields.temperature !== undefined && fields.temperature !== null) {
      airtableFields['Temperature'] = parseFloat(fields.temperature)
    }
    if (fields.systemPrompt !== undefined && fields.systemPrompt !== null) {
      airtableFields['System Prompt'] = fields.systemPrompt
    }

    console.log(`[AGENT UPDATE] Updating ${recordId}:`, Object.keys(airtableFields))

    const result = await updateAgent(recordId, airtableFields)

    return NextResponse.json({
      success: true,
      record: result,
    })
  } catch (error) {
    console.error('Agent update error:', error.message)
    // Return the actual Airtable error message for debugging
    return NextResponse.json(
      { error: error.message, details: 'Check Airtable field names: Status, Model, Temperature, System Prompt' },
      { status: 500 }
    )
  }
}

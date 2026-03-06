// System Status API — reports whether the pipeline is paused/running
// Used by dashboard to show system state banner

import { successResponse } from '../../../lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const paused = process.env.SYSTEM_PAUSED === 'true'

  return successResponse({
    paused,
    status: paused ? 'paused' : 'running',
    message: paused
      ? 'System is paused. Cron jobs will skip processing until SYSTEM_PAUSED is set to false.'
      : 'System is running normally.',
    crons: {
      runAgents: { schedule: '*/15 * * * *', active: !paused },
      dailyDigest: { schedule: '0 14 * * *', active: !paused },
    },
  })
}

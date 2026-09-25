import type { SessionLogEvent } from './types'

const duration = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
    : `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

const safeMonth = (timestamp: string): string => {
  const match = timestamp.match(/^(\d{4})-(\d{2})/)
  if (!match) throw new Error('Event timestamp must begin with YYYY-MM')
  return `${match[1]}-${match[2]}`
}

export function getMonthlyLogRelativePath(timestamp: string): string {
  return `Deep Dive/Focus History/${safeMonth(timestamp)}.md`
}

export function formatLogEvent(event: SessionLogEvent): string {
  const { session, metrics } = event
  const lines = [
    `<!-- deep-dive-event:${event.eventId} -->`,
    `## ${event.type} · ${event.timestamp}`,
    '',
    `- Event ID: ${event.eventId}`,
    `- Timezone: ${event.timezone}`,
    `- Session ID: ${session.id}`,
    `- Kind: ${session.kind}`,
    `- Status: ${session.status}`,
    `- Activity: ${session.activity}`,
    ...(session.taskId ? [`- QuestLog task ID: ${session.taskId}`] : []),
    `- Planned: ${duration(session.plannedDurationMs)}`,
    `- Actual running: ${duration(metrics.actualRunningMs)}`,
    `- Paused: ${duration(metrics.pausedMs)}`,
    `- Overtime: ${duration(metrics.overtimeMs)}`,
    `- Started: ${session.startedAt}`,
    ...(session.surfacedAt ? [`- Surface reached: ${session.surfacedAt}`] : []),
    ...(session.endedAt ? [`- Ended: ${session.endedAt}`] : []),
    '',
    '---',
    ''
  ]
  return `${lines.join('\n')}\n`
}

export function eventMarker(eventId: string): string {
  return `<!-- deep-dive-event:${eventId} -->`
}

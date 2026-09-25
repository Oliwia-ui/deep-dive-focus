import { describe, expect, it } from 'vitest'
import type { SessionLogEvent } from '../../../shared/types'
import { formatLogEvent, getMonthlyLogRelativePath } from './logging'

const completedEvent: SessionLogEvent = {
  eventId: 'event-123',
  type: 'SESSION_COMPLETED',
  timestamp: '2026-09-25T14:31:04.000+02:00',
  timezone: 'Europe/Warsaw (UTC+02:00)',
  session: {
    id: 'session-123',
    kind: 'focus',
    status: 'completed',
    activity: 'Finish prototype notes',
    taskId: 'quest-abc',
    plannedDurationMs: 1_500_000,
    accumulatedRunningMs: 1_620_000,
    accumulatedPausedMs: 90_000,
    startedAt: '2026-09-25T14:02:34.000+02:00',
    surfacedAt: '2026-09-25T14:27:34.000+02:00',
    endedAt: '2026-09-25T14:31:04.000+02:00',
    overtime: true
  },
  metrics: {
    actualRunningMs: 1_620_000,
    pausedMs: 90_000,
    remainingMs: 0,
    overtimeMs: 120_000,
    progress: 1
  }
}

describe('Obsidian event formatting', () => {
  it('uses the monthly Deep Dive path and includes honest completion metrics plus an idempotency marker', () => {
    expect(getMonthlyLogRelativePath(completedEvent.timestamp)).toBe(
      'Deep Dive/Focus History/2026-09.md'
    )

    const markdown = formatLogEvent(completedEvent)
    expect(markdown).toContain('<!-- deep-dive-event:event-123 -->')
    expect(markdown).toContain('SESSION_COMPLETED')
    expect(markdown).toContain('Planned: 25m 00s')
    expect(markdown).toContain('Actual running: 27m 00s')
    expect(markdown).toContain('Paused: 1m 30s')
    expect(markdown).toContain('Overtime: 2m 00s')
    expect(markdown).toContain('QuestLog task ID: quest-abc')
  })
})

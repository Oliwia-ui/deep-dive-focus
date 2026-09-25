import { describe, expect, it } from 'vitest'
import {
  createSession,
  getSessionMetrics,
  pauseSession,
  resumeSession,
  settleSession,
  shouldSurface,
  stayBelow,
  surfaceSession
} from './timer'

describe('timer state machine', () => {
  it('excludes paused time from actual running duration when a session resumes', () => {
    const started = createSession({
      id: 'session-1',
      kind: 'focus',
      activity: 'Write the prototype report',
      taskId: 'quest-7',
      plannedDurationMs: 25 * 60_000,
      now: 1_000
    })

    const paused = pauseSession(started, 61_000)
    const resumed = resumeSession(paused, 181_000)
    const metrics = getSessionMetrics(resumed, 241_000)

    expect(metrics.actualRunningMs).toBe(120_000)
    expect(metrics.pausedMs).toBe(120_000)
    expect(metrics.remainingMs).toBe(23 * 60_000)
  })

  it('pauses at the planned boundary without counting delayed UI ticks as focus time', () => {
    const started = createSession({
      id: 'session-2',
      kind: 'focus',
      activity: 'Read chapter',
      plannedDurationMs: 60_000,
      now: 0
    })

    expect(shouldSurface(started, 75_000)).toBe(true)
    const surfaced = surfaceSession(started, 75_000, true)

    expect(surfaced.status).toBe('surface')
    expect(getSessionMetrics(surfaced, 90_000).actualRunningMs).toBe(60_000)
    expect(surfaced.surfacedAt).toBe('1970-01-01T00:01:00.000Z')
  })

  it('keeps the original plan while Stay Below records positive overtime', () => {
    const started = createSession({
      id: 'session-3',
      kind: 'focus',
      activity: 'Keep writing',
      plannedDurationMs: 60_000,
      now: 0
    })
    const surfaced = surfaceSession(started, 60_000, true)
    const overtime = stayBelow(surfaced, 70_000)
    const completed = settleSession(overtime, 'completed', 100_000)
    const metrics = getSessionMetrics(completed, 100_000)

    expect(completed.plannedDurationMs).toBe(60_000)
    expect(metrics.actualRunningMs).toBe(90_000)
    expect(metrics.overtimeMs).toBe(30_000)
  })

  it('preserves break kind so break history can remain separate from focused study', () => {
    const session = createSession({
      id: 'break-1',
      kind: 'break',
      activity: 'Surface break',
      plannedDurationMs: 5 * 60_000,
      now: 5_000
    })

    expect(session.kind).toBe('break')
  })
})

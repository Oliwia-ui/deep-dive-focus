import { describe, expect, it, vi } from 'vitest'
import type { AppState, DeepDiveApi, SessionLogEvent } from '../../../shared/types'
import { persistMutationWithLog } from './session-store'

const state: AppState = {
  version: 1,
  settings: {
    focusDurationMinutes: 25,
    shortBreakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    soundEnabled: true,
    vaultPath: '/vault'
  },
  activeSession: null,
  history: [],
  pendingLogEvents: []
}

const event: SessionLogEvent = {
  eventId: 'event-1',
  type: 'SESSION_STARTED',
  timestamp: '2026-09-25T10:00:00.000Z',
  timezone: 'UTC (UTC+00:00)',
  session: {
    id: 'session-1',
    kind: 'focus',
    status: 'running',
    activity: 'Study',
    plannedDurationMs: 1_500_000,
    accumulatedRunningMs: 0,
    accumulatedPausedMs: 0,
    startedAt: '2026-09-25T10:00:00.000Z',
    runStartedAt: '2026-09-25T10:00:00.000Z',
    overtime: false
  },
  metrics: {
    actualRunningMs: 0,
    pausedMs: 0,
    remainingMs: 1_500_000,
    overtimeMs: 0,
    progress: 0
  }
}

describe('mutation and log sequencing', () => {
  it('persists authoritative state before appending and queues a failed log without losing the mutation', async () => {
    const calls: string[] = []
    const api = {
      saveState: vi.fn(async () => {
        calls.push('save')
      }),
      appendLogEvent: vi.fn(async () => {
        calls.push('append')
        return { ok: false, error: 'Vault unavailable' }
      })
    } as unknown as DeepDiveApi

    const result = await persistMutationWithLog(state, event, api)

    expect(calls).toEqual(['save', 'append', 'save'])
    expect(result.pendingLogEvents).toHaveLength(1)
    expect(result.pendingLogEvents[0].event.eventId).toBe('event-1')
    expect(result.pendingLogEvents[0].lastError).toBe('Vault unavailable')
  })
})

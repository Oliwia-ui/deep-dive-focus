import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionLogEvent } from '../shared/types'
import { appendSessionLogEvent } from './vault-log'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

const event: SessionLogEvent = {
  eventId: 'dedupe-event',
  type: 'SESSION_CANCELLED',
  timestamp: '2026-09-25T10:00:00.000Z',
  timezone: 'Europe/Warsaw (UTC+02:00)',
  session: {
    id: 'session-1',
    kind: 'focus',
    status: 'cancelled',
    activity: 'Test retry',
    plannedDurationMs: 60_000,
    accumulatedRunningMs: 20_000,
    accumulatedPausedMs: 5_000,
    startedAt: '2026-09-25T09:59:35.000Z',
    endedAt: '2026-09-25T10:00:00.000Z',
    overtime: false
  },
  metrics: {
    actualRunningMs: 20_000,
    pausedMs: 5_000,
    remainingMs: 40_000,
    overtimeMs: 0,
    progress: 1 / 3
  }
}

describe('vault log adapter', () => {
  it('appends a retried event only once by checking its event ID marker', async () => {
    const vault = await mkdtemp(join(tmpdir(), 'deep-dive-vault-'))
    directories.push(vault)

    const first = await appendSessionLogEvent(vault, event)
    const retry = await appendSessionLogEvent(vault, event)
    const markdown = await readFile(join(vault, 'Deep Dive/Focus History/2026-09.md'), 'utf8')

    expect(first.ok).toBe(true)
    expect(retry).toMatchObject({ ok: true, duplicate: true })
    expect(markdown.match(/deep-dive-event:dedupe-event/g)).toHaveLength(1)
  })
})

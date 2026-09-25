import type { Session, SessionKind, SessionMetrics } from '../../../shared/types'

interface CreateSessionInput {
  id: string
  kind: SessionKind
  activity: string
  taskId?: string
  plannedDurationMs: number
  now: number
}

const iso = (timestamp: number): string => new Date(timestamp).toISOString()
const timestamp = (value?: string): number => (value ? new Date(value).getTime() : 0)

export function createSession(input: CreateSessionInput): Session {
  return {
    id: input.id,
    kind: input.kind,
    status: 'running',
    activity: input.activity.trim(),
    ...(input.taskId?.trim() ? { taskId: input.taskId.trim() } : {}),
    plannedDurationMs: input.plannedDurationMs,
    accumulatedRunningMs: 0,
    accumulatedPausedMs: 0,
    startedAt: iso(input.now),
    runStartedAt: iso(input.now),
    overtime: false
  }
}

export function getSessionMetrics(session: Session, now: number): SessionMetrics {
  const liveRunning =
    session.status === 'running' && session.runStartedAt
      ? Math.max(0, now - timestamp(session.runStartedAt))
      : 0
  const livePaused =
    session.status === 'paused' && session.pauseStartedAt
      ? Math.max(0, now - timestamp(session.pauseStartedAt))
      : 0
  const actualRunningMs = session.accumulatedRunningMs + liveRunning
  const pausedMs = session.accumulatedPausedMs + livePaused
  const overtimeMs = Math.max(0, actualRunningMs - session.plannedDurationMs)

  return {
    actualRunningMs,
    pausedMs,
    remainingMs: Math.max(0, session.plannedDurationMs - actualRunningMs),
    overtimeMs,
    progress: Math.min(1, actualRunningMs / session.plannedDurationMs)
  }
}

export function pauseSession(session: Session, now: number): Session {
  if (session.status !== 'running' || !session.runStartedAt) return session
  return {
    ...session,
    status: 'paused',
    accumulatedRunningMs:
      session.accumulatedRunningMs + Math.max(0, now - timestamp(session.runStartedAt)),
    runStartedAt: undefined,
    pauseStartedAt: iso(now)
  }
}

export function resumeSession(session: Session, now: number): Session {
  if (session.status !== 'paused' || !session.pauseStartedAt) return session
  return {
    ...session,
    status: 'running',
    accumulatedPausedMs:
      session.accumulatedPausedMs + Math.max(0, now - timestamp(session.pauseStartedAt)),
    pauseStartedAt: undefined,
    runStartedAt: iso(now)
  }
}

export function surfaceSession(session: Session, now: number, plannedEnd = false): Session {
  if (session.status === 'surface') return session
  let surfaced = session

  if (session.status === 'running' && session.runStartedAt) {
    const elapsed = Math.max(0, now - timestamp(session.runStartedAt))
    const runningIncrement = plannedEnd
      ? Math.min(elapsed, Math.max(0, session.plannedDurationMs - session.accumulatedRunningMs))
      : elapsed
    const surfaceTime = plannedEnd ? timestamp(session.runStartedAt) + runningIncrement : now
    surfaced = {
      ...session,
      accumulatedRunningMs: session.accumulatedRunningMs + runningIncrement,
      runStartedAt: undefined,
      surfacedAt: iso(surfaceTime)
    }
  } else if (session.status === 'paused' && session.pauseStartedAt) {
    surfaced = {
      ...session,
      accumulatedPausedMs:
        session.accumulatedPausedMs + Math.max(0, now - timestamp(session.pauseStartedAt)),
      pauseStartedAt: undefined,
      surfacedAt: iso(now)
    }
  }

  return { ...surfaced, status: 'surface' }
}

export function stayBelow(session: Session, now: number): Session {
  if (session.status !== 'surface') return session
  return {
    ...session,
    status: 'running',
    overtime: true,
    runStartedAt: iso(now)
  }
}

export function settleSession(
  session: Session,
  outcome: 'completed' | 'cancelled',
  now: number
): Session {
  let settled = session
  if (session.status === 'running') settled = pauseSession(session, now)
  if (settled.status === 'paused' && settled.pauseStartedAt) {
    settled = {
      ...settled,
      accumulatedPausedMs:
        settled.accumulatedPausedMs + Math.max(0, now - timestamp(settled.pauseStartedAt)),
      pauseStartedAt: undefined
    }
  }
  return {
    ...settled,
    status: outcome,
    runStartedAt: undefined,
    pauseStartedAt: undefined,
    endedAt: iso(now)
  }
}

export function shouldSurface(session: Session, now: number): boolean {
  return (
    session.status === 'running' &&
    !session.overtime &&
    getSessionMetrics(session, now).actualRunningMs >= session.plannedDurationMs
  )
}

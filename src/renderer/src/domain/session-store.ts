import type {
  AppState,
  DeepDiveApi,
  LogEventType,
  PendingLogEvent,
  Session,
  SessionLogEvent
} from '../../../shared/types'
import { getSessionMetrics } from './timer'

export const defaultState: AppState = {
  version: 1,
  settings: {
    focusDurationMinutes: 25,
    shortBreakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    soundEnabled: true
  },
  activeSession: null,
  history: [],
  pendingLogEvents: []
}

function offsetLabel(date: Date): string {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0')
  return `UTC${sign}${hours}:${minutes}`
}

export function createLogEvent(
  eventId: string,
  type: LogEventType,
  session: Session,
  now: number
): SessionLogEvent {
  const date = new Date(now)
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time'
  return {
    eventId,
    type,
    timestamp: date.toISOString(),
    timezone: `${timezoneName} (${offsetLabel(date)})`,
    session,
    metrics: getSessionMetrics(session, now)
  }
}

function upsertPending(
  pending: PendingLogEvent[],
  event: SessionLogEvent,
  error: string
): PendingLogEvent[] {
  const existing = pending.find((item) => item.event.eventId === event.eventId)
  const next: PendingLogEvent = {
    event,
    attempts: (existing?.attempts ?? 0) + 1,
    lastError: error
  }
  return [...pending.filter((item) => item.event.eventId !== event.eventId), next]
}

export async function persistMutationWithLog(
  nextState: AppState,
  event: SessionLogEvent,
  api: DeepDiveApi
): Promise<AppState> {
  await api.saveState(nextState)
  const vaultPath = nextState.settings.vaultPath
  if (!vaultPath) {
    const queued = {
      ...nextState,
      pendingLogEvents: upsertPending(
        nextState.pendingLogEvents,
        event,
        'Choose an Obsidian vault to write this event.'
      )
    }
    await api.saveState(queued)
    return queued
  }

  const result = await api.appendLogEvent(vaultPath, event)
  if (result.ok) return nextState

  const queued = {
    ...nextState,
    pendingLogEvents: upsertPending(
      nextState.pendingLogEvents,
      event,
      result.error || 'Unable to append the event.'
    )
  }
  await api.saveState(queued)
  return queued
}

export async function retryPendingLogs(state: AppState, api: DeepDiveApi): Promise<AppState> {
  const vaultPath = state.settings.vaultPath
  if (!vaultPath || state.pendingLogEvents.length === 0) return state

  const stillPending: PendingLogEvent[] = []
  for (const item of state.pendingLogEvents) {
    const result = await api.appendLogEvent(vaultPath, item.event)
    if (!result.ok) {
      stillPending.push({
        ...item,
        attempts: item.attempts + 1,
        lastError: result.error || 'Unable to append the event.'
      })
    }
  }

  const next = { ...state, pendingLogEvents: stillPending }
  await api.saveState(next)
  return next
}

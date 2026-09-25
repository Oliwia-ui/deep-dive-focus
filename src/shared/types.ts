export type SessionKind = 'focus' | 'break'
export type SessionStatus = 'running' | 'paused' | 'surface' | 'completed' | 'cancelled'

export interface Session {
  id: string
  kind: SessionKind
  status: SessionStatus
  activity: string
  taskId?: string
  plannedDurationMs: number
  accumulatedRunningMs: number
  accumulatedPausedMs: number
  startedAt: string
  runStartedAt?: string
  pauseStartedAt?: string
  surfacedAt?: string
  endedAt?: string
  overtime: boolean
}

export interface SessionMetrics {
  actualRunningMs: number
  pausedMs: number
  remainingMs: number
  overtimeMs: number
  progress: number
}

export interface AppSettings {
  focusDurationMinutes: number
  shortBreakDurationMinutes: number
  longBreakDurationMinutes: number
  soundEnabled: boolean
  vaultPath?: string
}

export type LogEventType = 'SESSION_STARTED' | 'SESSION_COMPLETED' | 'SESSION_CANCELLED'

export interface SessionLogEvent {
  eventId: string
  type: LogEventType
  timestamp: string
  timezone: string
  session: Session
  metrics: SessionMetrics
}

export interface PendingLogEvent {
  event: SessionLogEvent
  attempts: number
  lastError: string
}

export interface AppState {
  version: 1
  settings: AppSettings
  activeSession: Session | null
  history: Session[]
  pendingLogEvents: PendingLogEvent[]
}

export interface AppendLogResult {
  ok: boolean
  duplicate?: boolean
  path?: string
  error?: string
}

export interface DeepDiveApi {
  loadState(): Promise<AppState>
  saveState(state: AppState): Promise<void>
  selectVault(): Promise<string | null>
  appendLogEvent(vaultPath: string, event: SessionLogEvent): Promise<AppendLogResult>
  notifySurface(activity: string, kind: SessionKind): Promise<void>
  getAppInfo(): Promise<{ version: string; dataPath: string }>
}

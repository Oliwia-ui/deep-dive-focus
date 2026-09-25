import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, Session, SessionKind } from '../../shared/types'
import {
  createSession,
  getSessionMetrics,
  pauseSession,
  resumeSession,
  settleSession,
  shouldSurface,
  stayBelow,
  surfaceSession
} from './domain/timer'
import {
  createLogEvent,
  defaultState,
  persistMutationWithLog,
  retryPendingLogs
} from './domain/session-store'
import { DEPTH_ZONES, depthForMinutes } from './visual-config'

type View = 'dive' | 'history' | 'settings'
type BreakLength = 'short' | 'long'

const formatClock = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const formatDateTime = (value?: string): string =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : '—'

function playSurfaceChime(): void {
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return
  const context = new AudioContextClass()
  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.15)
  gain.connect(context.destination)
  ;[392, 523.25, 659.25].forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    oscillator.start(context.currentTime + index * 0.12)
    oscillator.stop(context.currentTime + 0.8 + index * 0.12)
  })
  window.setTimeout(() => void context.close(), 1500)
}

function App(): React.JSX.Element {
  const [state, setState] = useState<AppState>(defaultState)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<View>('dive')
  const [activity, setActivity] = useState('')
  const [taskId, setTaskId] = useState('')
  const [breakLength, setBreakLength] = useState<BreakLength>('short')
  const [now, setNow] = useState(0)
  const [statusMessage, setStatusMessage] = useState('Stored locally')
  const [appInfo, setAppInfo] = useState<{ version: string; dataPath: string } | null>(null)
  const surfaceInFlight = useRef(false)

  useEffect(() => {
    Promise.all([window.deepDive.loadState(), window.deepDive.getAppInfo()])
      .then(([saved, info]) => {
        setState(saved)
        setAppInfo(info)
        if (saved.activeSession) {
          setActivity(saved.activeSession.activity)
          setTaskId(saved.activeSession.taskId || '')
        }
        setLoaded(true)
      })
      .catch((error: unknown) => {
        setStatusMessage(error instanceof Error ? error.message : 'Unable to load local data')
        setLoaded(true)
      })
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  const saveState = useCallback(async (next: AppState): Promise<void> => {
    setState(next)
    await window.deepDive.saveState(next)
  }, [])

  const active = state.activeSession
  const metrics = useMemo(() => (active ? getSessionMetrics(active, now) : null), [active, now])

  const arriveAtSurface = useCallback(
    async (session: Session, timestamp: number) => {
      if (surfaceInFlight.current) return
      surfaceInFlight.current = true
      try {
        const surfaced = surfaceSession(session, timestamp, true)
        const next = { ...state, activeSession: surfaced }
        await saveState(next)
        await window.deepDive.notifySurface(surfaced.activity, surfaced.kind)
        if (state.settings.soundEnabled) playSurfaceChime()
      } finally {
        surfaceInFlight.current = false
      }
    },
    [saveState, state]
  )

  useEffect(() => {
    if (active && shouldSurface(active, now)) void arriveAtSurface(active, now)
  }, [active, arriveAtSurface, now])

  const startFromState = async (
    base: AppState,
    kind: SessionKind,
    plannedMinutes: number,
    nextActivity: string,
    nextTaskId = ''
  ): Promise<AppState> => {
    const timestamp = Date.now()
    const session = createSession({
      id: crypto.randomUUID(),
      kind,
      activity: nextActivity,
      taskId: kind === 'focus' ? nextTaskId : undefined,
      plannedDurationMs: plannedMinutes * 60_000,
      now: timestamp
    })
    const next = { ...base, activeSession: session }
    const event = createLogEvent(crypto.randomUUID(), 'SESSION_STARTED', session, timestamp)
    const persisted = await persistMutationWithLog(next, event, window.deepDive)
    setState(persisted)
    setView('dive')
    return persisted
  }

  const startFocus = async (): Promise<void> => {
    if (!activity.trim()) {
      setStatusMessage('Add an activity before starting a focus dive.')
      return
    }
    await startFromState(
      state,
      'focus',
      state.settings.focusDurationMinutes,
      activity.trim(),
      taskId.trim()
    )
  }

  const startBreak = async (base = state): Promise<void> => {
    const minutes =
      breakLength === 'short'
        ? base.settings.shortBreakDurationMinutes
        : base.settings.longBreakDurationMinutes
    await startFromState(
      base,
      'break',
      minutes,
      breakLength === 'short' ? 'Short surface break' : 'Long surface break'
    )
  }

  const togglePause = async (): Promise<void> => {
    if (!active) return
    const updated =
      active.status === 'running'
        ? pauseSession(active, Date.now())
        : resumeSession(active, Date.now())
    await saveState({ ...state, activeSession: updated })
  }

  const askForDecision = async (): Promise<void> => {
    if (!active) return
    await saveState({ ...state, activeSession: surfaceSession(active, Date.now()) })
  }

  const settle = async (outcome: 'completed' | 'cancelled', beginBreak = false): Promise<void> => {
    if (!active) return
    const timestamp = Date.now()
    const settled = settleSession(active, outcome, timestamp)
    const next: AppState = {
      ...state,
      activeSession: null,
      history: [settled, ...state.history]
    }
    const event = createLogEvent(
      crypto.randomUUID(),
      outcome === 'completed' ? 'SESSION_COMPLETED' : 'SESSION_CANCELLED',
      settled,
      timestamp
    )
    const persisted = await persistMutationWithLog(next, event, window.deepDive)
    setState(persisted)
    setStatusMessage(
      outcome === 'completed' ? 'Dive saved to history.' : 'Cancelled dive retained in history.'
    )
    if (beginBreak) await startBreak(persisted)
  }

  const continueOvertime = async (): Promise<void> => {
    if (!active) return
    await saveState({ ...state, activeSession: stayBelow(active, Date.now()) })
  }

  const updateSettings = async (patch: Partial<AppState['settings']>): Promise<void> => {
    const next = { ...state, settings: { ...state.settings, ...patch } }
    await saveState(next)
  }

  const chooseVault = async (): Promise<void> => {
    const vaultPath = await window.deepDive.selectVault()
    if (!vaultPath) return
    await updateSettings({ vaultPath })
    setStatusMessage('Obsidian vault selected. Future events will append there.')
  }

  const retryLogs = async (): Promise<void> => {
    const next = await retryPendingLogs(state, window.deepDive)
    setState(next)
    setStatusMessage(
      next.pendingLogEvents.length === 0
        ? 'All pending events were written.'
        : `${next.pendingLogEvents.length} event(s) still need attention.`
    )
  }

  const toggleSound = async (): Promise<void> => {
    await updateSettings({ soundEnabled: !state.settings.soundEnabled })
  }

  if (!loaded) return <main className="loading-screen">Preparing dive computer…</main>

  const plannedMinutes = active
    ? active.plannedDurationMs / 60_000
    : state.settings.focusDurationMinutes
  const startDepth = depthForMinutes(plannedMinutes)
  const depth =
    active && metrics ? (active.overtime ? 1.5 : startDepth * (1 - metrics.progress)) : startDepth
  const ascentPercent = active && metrics ? Math.min(100, metrics.progress * 100) : 0
  const timerValue =
    active && metrics
      ? active.overtime
        ? `+${formatClock(metrics.overtimeMs)}`
        : formatClock(metrics.remainingMs)
      : formatClock(state.settings.focusDurationMinutes * 60_000)

  return (
    <main className="app-shell">
      <header className="titlebar">
        <div className="titlebar-drag" />
        <div className="wordmark">
          <WaveIcon /> Deep Dive
        </div>
        <div className="top-actions">
          <button
            className="icon-button"
            onClick={() => void toggleSound()}
            aria-label={state.settings.soundEnabled ? 'Mute sound' : 'Enable sound'}
          >
            {state.settings.soundEnabled ? '◖))' : '◖×'}
          </button>
          <button
            className="icon-button"
            onClick={() => setView('settings')}
            aria-label="Open settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="sidebar" aria-label="Application sections">
          <p className="nav-label">Dive computer</p>
          <button
            className={`nav-item ${view === 'dive' ? 'active' : ''}`}
            onClick={() => setView('dive')}
          >
            ◷ <span>Current dive</span>
          </button>
          <button
            className={`nav-item ${view === 'history' ? 'active' : ''}`}
            onClick={() => setView('history')}
          >
            ▥ <span>Dive history</span>
            <b>{state.history.length}</b>
          </button>
          <button
            className={`nav-item ${view === 'settings' ? 'active' : ''}`}
            onClick={() => setView('settings')}
          >
            ⌁ <span>Settings</span>
          </button>
          <div className="sidebar-spacer" />
          {state.pendingLogEvents.length > 0 && (
            <button className="log-warning" onClick={() => void retryLogs()}>
              <strong>{state.pendingLogEvents.length} unlogged event(s)</strong>
              Retry Obsidian append
            </button>
          )}
          <div className="local-status">
            <i /> <span>{statusMessage}</span>
          </div>
        </nav>

        {view === 'dive' && (
          <section
            className={`dive-stage state-${active?.status || 'idle'} ${active?.overtime ? 'is-overtime' : ''}`}
          >
            <div className="sun-rays" />
            <div className="surface-line">
              <span>Surface · 0 m</span>
            </div>
            <div className="bubble-field" aria-hidden="true">
              {Array.from({ length: 10 }, (_, index) => (
                <i className="bubble" key={index} />
              ))}
            </div>
            <div className="zone-scale" aria-hidden="true">
              {DEPTH_ZONES.map((zone) => (
                <div className="zone" key={zone}>
                  <span>{zone}</span>
                </div>
              ))}
            </div>
            <div
              className="depth-rail"
              style={{ '--ascent': `${ascentPercent}%` } as React.CSSProperties}
              aria-label={`Illustrative depth ${depth.toFixed(1)} metres`}
            >
              <div className="rail-line" />
              <div className="depth-capsule">{depth.toFixed(0)} M</div>
            </div>

            <div className="dive-content">
              <div className="live-pill">
                <i />{' '}
                {active
                  ? active.status === 'paused'
                    ? 'Ascent paused'
                    : active.status === 'surface'
                      ? 'At surface'
                      : active.overtime
                        ? 'Overtime · just below surface'
                        : active.kind === 'focus'
                          ? 'Focused ascent'
                          : 'Surface interval'
                  : 'Ready to descend'}
              </div>

              {!active ? (
                <section className="setup-card">
                  <p className="activity-kicker">Plan the next dive</p>
                  <h1>What are you going below for?</h1>
                  <label>
                    Activity description
                    <input
                      value={activity}
                      onChange={(event) => setActivity(event.target.value)}
                      placeholder="e.g. Finish interaction design report"
                      maxLength={160}
                    />
                  </label>
                  <label>
                    QuestLog task ID <span>optional</span>
                    <input
                      value={taskId}
                      onChange={(event) => setTaskId(event.target.value)}
                      placeholder="Paste a stable task ID"
                      maxLength={120}
                    />
                  </label>
                  <div className="plan-summary">
                    <span>Focus plan</span>
                    <strong>
                      {state.settings.focusDurationMinutes} min · {startDepth} m
                    </strong>
                  </div>
                  <div className="setup-actions">
                    <button className="primary-action" onClick={() => void startFocus()}>
                      Begin Focus Dive
                    </button>
                    <button className="secondary-action" onClick={() => void startBreak()}>
                      Start Break
                    </button>
                  </div>
                  <div className="break-choice">
                    <button
                      className={breakLength === 'short' ? 'selected' : ''}
                      onClick={() => setBreakLength('short')}
                    >
                      Short · {state.settings.shortBreakDurationMinutes}m
                    </button>
                    <button
                      className={breakLength === 'long' ? 'selected' : ''}
                      onClick={() => setBreakLength('long')}
                    >
                      Long · {state.settings.longBreakDurationMinutes}m
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <span className="activity-kicker">
                    {active.kind === 'focus' ? 'Current activity' : 'Recovery interval'}
                  </span>
                  <h1 className="activity-title">{active.activity}</h1>
                  {active.taskId && <span className="quest-id">QUESTLOG · {active.taskId}</span>}
                  <div className="timer-wrap">
                    <div className="sonar-ring" />
                    <div className="timer">
                      <span>{timerValue}</span>
                      <small>
                        {active.overtime
                          ? 'overtime · stay below'
                          : active.status === 'paused'
                            ? 'timer paused'
                            : active.status === 'surface'
                              ? 'planned time reached'
                              : 'remaining · ascent in progress'}
                      </small>
                    </div>
                    <DiverIcon />
                  </div>
                  <div className="metrics">
                    <Metric label="Planned" value={formatClock(active.plannedDurationMs)} />
                    <Metric
                      label={active.kind === 'focus' ? 'Focused' : 'Break'}
                      value={formatClock(metrics?.actualRunningMs || 0)}
                    />
                    <Metric label="Paused" value={formatClock(metrics?.pausedMs || 0)} />
                    {active.overtime && (
                      <Metric
                        label="Overtime"
                        value={`+${formatClock(metrics?.overtimeMs || 0)}`}
                        warm
                      />
                    )}
                  </div>
                  {active.status !== 'surface' && (
                    <div className="controls">
                      <button className="primary-action" onClick={() => void togglePause()}>
                        {active.status === 'paused' ? 'Resume ascent' : 'Pause ascent'}
                      </button>
                      <button className="secondary-action" onClick={() => void askForDecision()}>
                        End {active.kind === 'focus' ? 'dive' : 'break'}…
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {active?.status === 'surface' && (
              <section
                className="surface-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="surface-title"
              >
                <div className="arrival-mark">
                  <WaveIcon />
                </div>
                <p className="eyebrow">Surface reached · timer paused</p>
                <h2 id="surface-title">
                  {active.kind === 'focus'
                    ? 'What happened on this dive?'
                    : 'Surface break complete.'}
                </h2>
                <p className="surface-copy">
                  Planned time and actual running time remain separate. Choose an outcome before
                  this session enters history.
                </p>
                <div className="receipt-strip">
                  <Metric label="Planned" value={formatClock(active.plannedDurationMs)} />
                  <Metric label="Actual" value={formatClock(metrics?.actualRunningMs || 0)} />
                  <Metric label="Paused" value={formatClock(metrics?.pausedMs || 0)} />
                </div>
                {active.kind === 'focus' ? (
                  <div className="decision-grid">
                    <button
                      className="decision-button complete"
                      onClick={() => void settle('completed')}
                    >
                      Complete Dive <span>✓</span>
                    </button>
                    <button
                      className="decision-button break"
                      onClick={() => void settle('completed', true)}
                    >
                      Start Surface Break <span>☕</span>
                    </button>
                    <button className="decision-button" onClick={() => void continueOvertime()}>
                      Stay Below <span>↓</span>
                    </button>
                    <button
                      className="decision-button cancel"
                      onClick={() => void settle('cancelled')}
                    >
                      Cancel Dive <span>×</span>
                    </button>
                  </div>
                ) : (
                  <div className="decision-grid">
                    <button
                      className="decision-button complete"
                      onClick={() => void settle('completed')}
                    >
                      Complete Break <span>✓</span>
                    </button>
                    <button className="decision-button" onClick={() => void continueOvertime()}>
                      Stay on Break <span>＋</span>
                    </button>
                    <button
                      className="decision-button cancel"
                      onClick={() => void settle('cancelled')}
                    >
                      Cancel Break <span>×</span>
                    </button>
                  </div>
                )}
                <p className="decision-note">
                  Reaching zero never completes a session automatically.
                </p>
              </section>
            )}
          </section>
        )}

        {view === 'history' && <HistoryView history={state.history} />}
        {view === 'settings' && (
          <SettingsView
            state={state}
            appInfo={appInfo}
            onUpdate={(patch) => void updateSettings(patch)}
            onChooseVault={() => void chooseVault()}
            onRetry={() => void retryLogs()}
          />
        )}
      </div>
    </main>
  )
}

function Metric({
  label,
  value,
  warm = false
}: {
  label: string
  value: string
  warm?: boolean
}): React.JSX.Element {
  return (
    <div className={`metric ${warm ? 'warm' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function HistoryView({ history }: { history: Session[] }): React.JSX.Element {
  return (
    <section className="content-view">
      <header>
        <p className="eyebrow">Append-only local record</p>
        <h1>Dive history</h1>
        <p>Completed and cancelled focus sessions and breaks, newest first.</p>
      </header>
      {history.length === 0 ? (
        <div className="empty-state">
          <WaveIcon />
          <h2>No surfaced sessions yet</h2>
          <p>Your honest session receipts will appear here.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((session) => {
            const metrics = getSessionMetrics(
              session,
              new Date(session.endedAt || session.startedAt).getTime()
            )
            return (
              <article className="history-card" key={session.id}>
                <div className={`history-kind ${session.kind}`}>
                  {session.kind === 'focus' ? 'Focus dive' : 'Surface break'}
                </div>
                <div className="history-main">
                  <div>
                    <h2>{session.activity}</h2>
                    <p>
                      {session.taskId
                        ? `QuestLog · ${session.taskId}`
                        : formatDateTime(session.startedAt)}
                    </p>
                  </div>
                  <span className={`status ${session.status}`}>{session.status}</span>
                </div>
                <div className="history-metrics">
                  <Metric label="Planned" value={formatClock(session.plannedDurationMs)} />
                  <Metric label="Actual" value={formatClock(metrics.actualRunningMs)} />
                  <Metric label="Paused" value={formatClock(metrics.pausedMs)} />
                  <Metric
                    label="Overtime"
                    value={metrics.overtimeMs ? `+${formatClock(metrics.overtimeMs)}` : '—'}
                    warm={metrics.overtimeMs > 0}
                  />
                </div>
                <footer>
                  <span>Started {formatDateTime(session.startedAt)}</span>
                  <span>Ended {formatDateTime(session.endedAt)}</span>
                </footer>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function SettingsView({
  state,
  appInfo,
  onUpdate,
  onChooseVault,
  onRetry
}: {
  state: AppState
  appInfo: { version: string; dataPath: string } | null
  onUpdate: (patch: Partial<AppState['settings']>) => void
  onChooseVault: () => void
  onRetry: () => void
}): React.JSX.Element {
  const durationInput = (
    label: string,
    key: 'focusDurationMinutes' | 'shortBreakDurationMinutes' | 'longBreakDurationMinutes'
  ): React.JSX.Element => (
    <label className="setting-row">
      <span>
        <strong>{label}</strong>
        <small>Minutes</small>
      </span>
      <input
        type="number"
        min="1"
        max="240"
        value={state.settings[key]}
        onChange={(event) =>
          onUpdate({ [key]: Math.max(1, Math.min(240, Number(event.target.value) || 1)) })
        }
      />
    </label>
  )
  return (
    <section className="content-view settings-view">
      <header>
        <p className="eyebrow">Local dive computer</p>
        <h1>Settings</h1>
        <p>Durations, calm feedback, and your user-selected Obsidian vault.</p>
      </header>
      <div className="settings-grid">
        <section className="settings-card">
          <h2>Session plans</h2>
          {durationInput('Default focus', 'focusDurationMinutes')}
          {durationInput('Short surface break', 'shortBreakDurationMinutes')}
          {durationInput('Long surface break', 'longBreakDurationMinutes')}
        </section>
        <section className="settings-card">
          <h2>Feedback</h2>
          <label className="toggle-row">
            <span>
              <strong>Quiet bubble chime</strong>
              <small>Generated locally with WebAudio</small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.soundEnabled}
              onChange={(event) => onUpdate({ soundEnabled: event.target.checked })}
            />
          </label>
          <p className="motion-note">
            Motion follows your macOS Reduce Motion preference automatically.
          </p>
        </section>
        <section className="settings-card vault-card">
          <h2>Obsidian history</h2>
          <p>
            Events append beneath <code>Deep Dive/Focus History/YYYY-MM.md</code>.
          </p>
          <div className="path-box">{state.settings.vaultPath || 'No vault selected'}</div>
          <button className="primary-action" onClick={onChooseVault}>
            {state.settings.vaultPath ? 'Change Vault' : 'Choose Vault'}
          </button>
          {state.pendingLogEvents.length > 0 && (
            <div className="retry-panel">
              <strong>{state.pendingLogEvents.length} event(s) waiting</strong>
              <p>{state.pendingLogEvents[0].lastError}</p>
              <button className="secondary-action" onClick={onRetry}>
                Retry now
              </button>
            </div>
          )}
        </section>
        <section className="settings-card">
          <h2>Local data</h2>
          <p>
            Authoritative state is stored as JSON using atomic replacement. No account or network is
            required.
          </p>
          <div className="path-box">{appInfo?.dataPath || 'Application data directory'}</div>
          <small>Deep Dive {appInfo?.version || ''} · macOS personal build</small>
        </section>
      </div>
    </section>
  )
}

function WaveIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7.6c2.4 1.2 4.7 1.2 7.1 0s4.8-1.2 7.2 0M6.2 11c1.8.9 3.7.9 5.5 0s3.7-.9 5.5 0M8.4 14.4c1.2.6 2.4.6 3.6 0s2.4-.6 3.6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
function DiverIcon(): React.JSX.Element {
  return (
    <svg className="diver" viewBox="0 0 120 82" fill="none" aria-hidden="true">
      <path d="M25 41c15-7 30-9 46-8l22 2 7 9-9 5-18-6-24 12-17-2-7-12Z" fill="#8adfce" />
      <path d="M68 34c-2-10 3-18 11-20 7-2 13 1 15 7 2 7-3 13-10 16" fill="#d8eee5" />
      <path d="M78 15c8-4 15-1 17 6l-13 4-7-3 3-7Z" fill="#123039" />
      <path
        d="m26 41-14-8-7 3 14 12m13 5-9 14-10 3 4-15"
        stroke="#8adfce"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m92 48 17 10m-20-13 18-3" stroke="#8adfce" strokeWidth="6" strokeLinecap="round" />
      <circle cx="99" cy="25" r="3" stroke="#a1f4dc" />
      <circle cx="106" cy="18" r="2" stroke="#a1f4dc" />
    </svg>
  )
}

export default App

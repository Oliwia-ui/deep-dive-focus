import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AppState } from '../shared/types'

export const createDefaultState = (): AppState => ({
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
})

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AppState>
  return (
    candidate.version === 1 &&
    !!candidate.settings &&
    Array.isArray(candidate.history) &&
    Array.isArray(candidate.pendingLogEvents)
  )
}

export class JsonStateStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<AppState> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      return isAppState(parsed) ? parsed : createDefaultState()
    } catch {
      return createDefaultState()
    }
  }

  async save(state: AppState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, this.filePath)
  }
}

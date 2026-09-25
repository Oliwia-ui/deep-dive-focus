import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonStateStore } from './storage'
import type { AppState } from '../shared/types'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

const state: AppState = {
  version: 1,
  settings: {
    focusDurationMinutes: 40,
    shortBreakDurationMinutes: 7,
    longBreakDurationMinutes: 18,
    soundEnabled: false,
    vaultPath: '/Users/example/Vault'
  },
  activeSession: null,
  history: [],
  pendingLogEvents: []
}

describe('JSON persistence adapter', () => {
  it('round-trips state through an atomic replacement file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deep-dive-'))
    directories.push(directory)
    const store = new JsonStateStore(join(directory, 'state.json'))

    await store.save(state)

    await expect(store.load()).resolves.toEqual(state)
  })

  it('falls back to defaults when persisted JSON is corrupt', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deep-dive-'))
    directories.push(directory)
    const path = join(directory, 'state.json')
    await writeFile(path, '{not json', 'utf8')
    const store = new JsonStateStore(path)

    const loaded = await store.load()

    expect(loaded.settings.focusDurationMinutes).toBe(25)
    expect(loaded.history).toEqual([])
  })
})

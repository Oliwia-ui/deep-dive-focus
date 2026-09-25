import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { eventMarker, formatLogEvent, getMonthlyLogRelativePath } from '../shared/logging'
import type { AppendLogResult, SessionLogEvent } from '../shared/types'

function ensureInsideVault(vaultPath: string, relativePath: string): string {
  const root = resolve(vaultPath)
  const target = resolve(root, relativePath)
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error('Invalid vault log path')
  }
  return target
}

export async function appendSessionLogEvent(
  vaultPath: string,
  event: SessionLogEvent
): Promise<AppendLogResult> {
  try {
    const target = ensureInsideVault(vaultPath, getMonthlyLogRelativePath(event.timestamp))
    await mkdir(dirname(target), { recursive: true })
    let existing = ''
    try {
      existing = await readFile(target, 'utf8')
    } catch {
      // A missing monthly file is expected on the first write.
    }
    if (existing.includes(eventMarker(event.eventId))) {
      return { ok: true, duplicate: true, path: target }
    }
    await appendFile(target, formatLogEvent(event), 'utf8')
    return { ok: true, path: target }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

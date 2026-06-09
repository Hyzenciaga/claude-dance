import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { Project } from '@shared/types'
import { decodeCwd, encodeCwd } from '@shared/encoding'
import { readAppData } from './app-data'

export type ScanOptions = {
  projectsDir: string
  appDataPath: string
}

export async function scanProjects(opts: ScanOptions): Promise<Project[]> {
  const appData = await readAppData(opts.appDataPath)
  const hidden = new Set(appData.hidden)

  const map = new Map<string, Project>()

  const scanned = await listScannedProjects(opts.projectsDir)
  for (const p of scanned) {
    map.set(p.path, { ...p, hidden: hidden.has(p.path) })
  }

  for (const manualPath of appData.manual) {
    if (map.has(manualPath)) {
      map.set(manualPath, { ...map.get(manualPath)!, source: 'manual' })
      continue
    }
    map.set(manualPath, {
      path: manualPath,
      encodedPath: encodeCwd(manualPath),
      exists: await dirExists(manualPath),
      sessionCount: 0,
      lastActiveAt: 0,
      source: 'manual',
      hidden: hidden.has(manualPath),
    })
  }

  return Array.from(map.values())
}

async function listScannedProjects(projectsDir: string): Promise<Project[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(projectsDir)
  } catch {
    return []
  }

  const results: Project[] = []
  for (const name of entries) {
    const full = join(projectsDir, name)
    let stat
    try {
      stat = await fs.stat(full)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue
    const sessionFiles = await listSessionFiles(full)
    // Prefer cwd from first jsonl line; fall back to decodeCwd (lossy for paths with hyphens)
    let decoded = decodeCwd(name)
    if (sessionFiles.length > 0) {
      const fromJsonl = await readCwdFromJsonl(join(full, sessionFiles[0]))
      if (fromJsonl !== null) decoded = fromJsonl
    }
    const lastActiveAt = await mostRecentMtime(full, sessionFiles)
    results.push({
      path: decoded,
      encodedPath: name,
      exists: await dirExists(decoded),
      sessionCount: sessionFiles.length,
      lastActiveAt,
      source: 'scanned',
      hidden: false,
    })
  }
  return results
}

async function readCwdFromJsonl(filePath: string): Promise<string | null> {
  try {
    const handle = await fs.open(filePath, 'r')
    const buffer = Buffer.alloc(8192)
    const { bytesRead } = await handle.read(buffer, 0, 8192, 0)
    await handle.close()
    const text = buffer.toString('utf8', 0, bytesRead)
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line) as Record<string, unknown>
        if (typeof obj['cwd'] === 'string' && obj['cwd'].length > 0) {
          return obj['cwd']
        }
      } catch { /* skip malformed */ }
      // Only parse one line then bail — if we can't get past the first record, fall through
    }
    return null
  } catch {
    return null
  }
}

async function listSessionFiles(projectDir: string): Promise<string[]> {
  const entries = await fs.readdir(projectDir).catch(() => [] as string[])
  return entries.filter((f) => f.endsWith('.jsonl'))
}

async function mostRecentMtime(dir: string, files: string[]): Promise<number> {
  let max = 0
  for (const f of files) {
    try {
      const stat = await fs.stat(join(dir, f))
      const ms = stat.mtimeMs
      if (ms > max) max = ms
    } catch {
      // ignore
    }
  }
  return max
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path)
    return stat.isDirectory()
  } catch {
    return false
  }
}

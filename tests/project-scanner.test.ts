import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProjects } from '../electron/project-scanner'

describe('scanProjects', () => {
  let root: string
  let projectsDir: string
  let appDataPath: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'claudedance-test-'))
    projectsDir = join(root, 'projects')
    appDataPath = join(root, 'projects.json')
    mkdirSync(projectsDir, { recursive: true })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('returns empty list when projects dir is empty', async () => {
    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result).toEqual([])
  })

  it('decodes project paths and counts session files', async () => {
    const encoded = '-tmp-foo'
    mkdirSync(join(projectsDir, encoded))
    writeFileSync(join(projectsDir, encoded, 'a.jsonl'), '')
    writeFileSync(join(projectsDir, encoded, 'b.jsonl'), '')
    writeFileSync(join(projectsDir, encoded, 'ignore.txt'), '')

    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('/tmp/foo')
    expect(result[0].encodedPath).toBe(encoded)
    expect(result[0].sessionCount).toBe(2)
    expect(result[0].source).toBe('scanned')
    expect(result[0].hidden).toBe(false)
  })

  it('marks exists=false when decoded path missing on disk', async () => {
    mkdirSync(join(projectsDir, '-nonexistent-path-xyz'))
    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result[0].exists).toBe(false)
  })

  it('merges manual projects from app data', async () => {
    const manualPath = join(root, 'manual-project')
    mkdirSync(manualPath)
    writeFileSync(
      appDataPath,
      JSON.stringify({ manual: [manualPath], hidden: [] }),
    )
    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(manualPath)
    expect(result[0].source).toBe('manual')
    expect(result[0].exists).toBe(true)
  })

  it('applies hidden flag from app data', async () => {
    const encoded = '-tmp-bar'
    mkdirSync(join(projectsDir, encoded))
    writeFileSync(
      appDataPath,
      JSON.stringify({ manual: [], hidden: ['/tmp/bar'] }),
    )
    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result[0].hidden).toBe(true)
  })

  it('reads cwd from first jsonl line, preferring it over decodeCwd', async () => {
    const encoded = '-tmp-foo-with-hyphens'
    mkdirSync(join(projectsDir, encoded))
    // Real cwd has hyphens; encoded loses them. The jsonl event has the real value.
    const realCwd = '/tmp/foo-with-hyphens'
    writeFileSync(
      join(projectsDir, encoded, 'a.jsonl'),
      JSON.stringify({ type: 'user', cwd: realCwd, sessionId: 'abc' }) + '\n',
    )
    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result[0].path).toBe(realCwd)
  })
})

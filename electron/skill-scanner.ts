import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { CommandInfo } from '@shared/types'

const CLAUDE_DIR = join(homedir(), '.claude')
const SKILLS_DIR = join(CLAUDE_DIR, 'skills')
const PLUGINS_JSON = join(CLAUDE_DIR, 'plugins', 'installed_plugins.json')
const SETTINGS_JSON = join(CLAUDE_DIR, 'settings.json')

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'))
  } catch {
    return null
  }
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }
  return result
}

async function scanSkillDir(dir: string, prefix?: string): Promise<CommandInfo[]> {
  const results: CommandInfo[] = []
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    const skillMd = join(dir, entry, 'SKILL.md')
    try {
      const content = await fs.readFile(skillMd, 'utf8')
      const fm = parseFrontmatter(content)
      const name = fm['name'] || entry
      const description = fm['description'] || ''
      results.push({
        name: prefix ? `${prefix}:${name}` : name,
        description,
      })
    } catch {
      // no SKILL.md, skip
    }
  }
  return results
}

async function scanCommandsDir(dir: string, prefix?: string): Promise<CommandInfo[]> {
  const results: CommandInfo[] = []
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const name = entry.replace(/\.md$/, '')
    try {
      const content = await fs.readFile(join(dir, entry), 'utf8')
      const fm = parseFrontmatter(content)
      results.push({
        name: prefix ? `${prefix}:${name}` : name,
        description: fm['description'] || '',
      })
    } catch {
      // skip unreadable
    }
  }
  return results
}

export async function discoverSkills(): Promise<CommandInfo[]> {
  const all: CommandInfo[] = []

  // 1. Global user skills (~/.claude/skills/)
  const globalSkills = await scanSkillDir(SKILLS_DIR)
  all.push(...globalSkills)

  // 2. Plugin skills + commands
  const settings = (await readJson(SETTINGS_JSON)) as Record<string, unknown> | null
  const enabledPlugins = (settings?.['enabledPlugins'] ?? {}) as Record<string, boolean>
  const enabledSet = new Set(
    Object.entries(enabledPlugins)
      .filter(([, v]) => v)
      .map(([k]) => k),
  )

  const installed = (await readJson(PLUGINS_JSON)) as Record<string, unknown> | null
  const plugins = (installed?.['plugins'] ?? {}) as Record<string, { installPath: string }[]>

  for (const [pluginKey, installs] of Object.entries(plugins)) {
    if (!enabledSet.has(pluginKey)) continue
    const install = installs[0]
    if (!install?.installPath) continue

    const pluginName = pluginKey.split('@')[0]
    const pluginRoot = install.installPath

    // Read plugin.json for explicit skills list and commands path
    const pluginJson = (await readJson(join(pluginRoot, '.claude-plugin', 'plugin.json'))) as Record<string, unknown> | null

    // Scan skills
    if (pluginJson?.['skills'] && Array.isArray(pluginJson['skills'])) {
      for (const skillPath of pluginJson['skills'] as string[]) {
        const skillDir = join(pluginRoot, skillPath)
        const skillMd = join(skillDir, 'SKILL.md')
        try {
          const content = await fs.readFile(skillMd, 'utf8')
          const fm = parseFrontmatter(content)
          const name = fm['name'] || skillPath.replace(/^\.\/skills\//, '').replace(/\/$/, '')
          all.push({ name: `${pluginName}:${name}`, description: fm['description'] || '' })
        } catch {
          // skip
        }
      }
    } else {
      // No explicit skills list — scan skills/ directory
      const skills = await scanSkillDir(join(pluginRoot, 'skills'), pluginName)
      all.push(...skills)
    }

    // Scan commands
    const commandsPath = typeof pluginJson?.['commands'] === 'string'
      ? join(pluginRoot, pluginJson['commands'] as string)
      : join(pluginRoot, 'commands')
    const cmds = await scanCommandsDir(commandsPath, pluginName)
    // Commands that duplicate a skill name — skip (they're just dispatchers)
    const skillNames = new Set(all.map((s) => s.name))
    for (const cmd of cmds) {
      if (!skillNames.has(cmd.name)) all.push(cmd)
    }
  }

  // Deduplicate by name
  const seen = new Set<string>()
  return all.filter((c) => {
    if (seen.has(c.name)) return false
    seen.add(c.name)
    return true
  })
}

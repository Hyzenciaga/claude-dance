import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

export type McpServerEntry = {
  name: string
  type?: string
  url?: string
  command?: string
  args?: string[]
  scope: 'global' | 'project'
}

type McpFileContent = {
  mcpServers?: Record<string, Record<string, unknown>>
}

function globalMcpPath(): string {
  return join(homedir(), '.mcp.json')
}

function projectMcpPath(projectDir: string): string {
  return join(projectDir, '.mcp.json')
}

async function readMcpFile(path: string): Promise<McpFileContent> {
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as McpFileContent
  } catch {
    return {}
  }
}

async function writeMcpFile(path: string, content: McpFileContent): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(content, null, 2) + '\n', 'utf8')
}

function toEntries(servers: Record<string, Record<string, unknown>>, scope: 'global' | 'project'): McpServerEntry[] {
  return Object.entries(servers).map(([name, cfg]) => ({
    name,
    type: typeof cfg['type'] === 'string' ? cfg['type'] : undefined,
    url: typeof cfg['url'] === 'string' ? cfg['url'] : undefined,
    command: typeof cfg['command'] === 'string' ? cfg['command'] : undefined,
    args: Array.isArray(cfg['args']) ? cfg['args'].map(String) : undefined,
    scope,
  }))
}

export async function listMcpConfig(projectDir?: string): Promise<McpServerEntry[]> {
  const globalData = await readMcpFile(globalMcpPath())
  const globalEntries = toEntries(globalData.mcpServers ?? {}, 'global')

  if (!projectDir) return globalEntries

  const projData = await readMcpFile(projectMcpPath(projectDir))
  const projEntries = toEntries(projData.mcpServers ?? {}, 'project')

  return [...projEntries, ...globalEntries]
}

export async function addMcpServer(
  name: string,
  config: Record<string, unknown>,
  scope: 'global' | 'project',
  projectDir?: string,
): Promise<void> {
  const path = scope === 'global' ? globalMcpPath() : projectMcpPath(projectDir!)
  const data = await readMcpFile(path)
  if (!data.mcpServers) data.mcpServers = {}
  data.mcpServers[name] = config
  await writeMcpFile(path, data)
}

export async function removeMcpServer(
  name: string,
  scope: 'global' | 'project',
  projectDir?: string,
): Promise<void> {
  const path = scope === 'global' ? globalMcpPath() : projectMcpPath(projectDir!)
  const data = await readMcpFile(path)
  if (data.mcpServers) {
    delete data.mcpServers[name]
    await writeMcpFile(path, data)
  }
}

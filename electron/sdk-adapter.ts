import { query, startup, getSessionMessages, renameSession as sdkRenameSession } from '@anthropic-ai/claude-agent-sdk'
import type { SDKMessage, SDKPartialAssistantMessage, Query, WarmQuery, RewindFilesResult } from '@anthropic-ai/claude-agent-sdk'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { Notification, type BrowserWindow } from 'electron'
import type { ChannelId, ChatStartRequest, RawEvent, PermissionRequest, AskUserQuestionRequest } from '@shared/types'
import { sendChatEvent } from './ipc-utils'
import { readAppData, type NotificationPrefs } from './app-data'
import { homedir } from 'node:os'
import { join } from 'node:path'


type ContentBlock = { type: string; [key: string]: unknown }

export type ModelInfo = { id: string; name: string }

type Channel = {
  id: ChannelId
  sessionId?: string
  cwd: string
  abortController: AbortController | null
  partialContent: ContentBlock[]
  activeQuery: Query | null
  cachedModels: ModelInfo[]
  selectedModel?: string
  selectedPermissionMode?: string
}

const APP_DATA_PATH = join(homedir(), '.claudedance', 'projects.json')

async function notifyIfBackground(
  kind: keyof NotificationPrefs,
  title: string,
  body: string,
): void {
  if (!mainWin || mainWin.isDestroyed() || mainWin.isFocused()) return
  if (!Notification.isSupported()) return
  try {
    const data = await readAppData(APP_DATA_PATH)
    if (!data.notifications[kind]) return
  } catch { return }
  const n = new Notification({ title, body: body.slice(0, 120), silent: false })
  n.on('click', () => { mainWin?.show(); mainWin?.focus() })
  n.show()
}

const MAX_CHANNELS = 3
const channels = new Map<ChannelId, Channel>()

let mainWin: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow): void {
  mainWin = win
}

type PendingPermission = {
  resolve: (allowed: boolean, message?: string) => void
}
const pendingPermissions = new Map<string, PendingPermission>()

type PendingQuestion = {
  resolve: (result: { cancelled: true } | { cancelled: false; answers: Record<string, string>; response?: string }) => void
}
const pendingQuestions = new Map<string, PendingQuestion>()

export function getModels(channelId: ChannelId): ModelInfo[] {
  return channels.get(channelId)?.cachedModels ?? []
}

export async function setModel(channelId: ChannelId, model: string): Promise<void> {
  const channel = channels.get(channelId)
  if (!channel) return
  channel.selectedModel = model
  if (channel.activeQuery) {
    try {
      await channel.activeQuery.setModel(model)
    } catch {
      // query may have ended between check and call
    }
  }
}

export async function setPermissionMode(channelId: ChannelId, mode: string): Promise<void> {
  const channel = channels.get(channelId)
  if (!channel) return
  channel.selectedPermissionMode = mode
  if (channel.activeQuery) {
    try {
      await channel.activeQuery.setPermissionMode(mode as import('@anthropic-ai/claude-agent-sdk').PermissionMode)
    } catch {
      // query may have ended between check and call
    }
  }
}

export async function rewindFiles(channelId: ChannelId, userMessageId?: string): Promise<RewindFilesResult> {
  const channel = channels.get(channelId)
  if (!channel?.activeQuery) return { canRewind: false, error: 'No active query' }
  if (!channel.sessionId) return { canRewind: false, error: 'No session' }

  let targetId = userMessageId
  if (!targetId) {
    const messages = await getSessionMessages(channel.sessionId, { dir: channel.cwd })
    const lastUser = [...messages].reverse().find((m) => m.type === 'user')
    if (!lastUser) return { canRewind: false, error: 'No user messages found' }
    targetId = lastUser.uuid
  }

  return channel.activeQuery.rewindFiles(targetId)
}

export type McpStatusInfo = {
  name: string
  status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'
  error?: string
  toolCount: number
  scope?: string
}

export async function getMcpStatus(channelId: ChannelId): Promise<McpStatusInfo[]> {
  const channel = channels.get(channelId)
  if (!channel?.activeQuery) return []
  try {
    const statuses = await channel.activeQuery.mcpServerStatus()
    return statuses.map((s) => ({
      name: s.name,
      status: s.status,
      error: s.error,
      toolCount: s.tools?.length ?? 0,
      scope: s.scope,
    }))
  } catch {
    return []
  }
}

export async function renameSession(sessionId: string, title: string, dir?: string): Promise<void> {
  await sdkRenameSession(sessionId, title, dir ? { dir } : undefined)
}

export function respondPermission(requestId: string, allowed: boolean, message?: string): void {
  const pending = pendingPermissions.get(requestId)
  if (!pending) return
  pendingPermissions.delete(requestId)
  pending.resolve(allowed, message)
}

export function respondQuestion(requestId: string, result: { cancelled: true } | { cancelled: false; answers: Record<string, string>; response?: string }): void {
  const pending = pendingQuestions.get(requestId)
  if (!pending) return
  pendingQuestions.delete(requestId)
  pending.resolve(result)
}

const warmQueries = new Map<string, WarmQuery>()

export async function warmup(cwd: string): Promise<void> {
  if (warmQueries.has(cwd)) return
  try {
    const warm = await startup({
      options: {
        cwd,
        pathToClaudeCodeExecutable: resolveClaudeBinary(),
        settingSources: ['project', 'user'],
      },
    })
    warmQueries.set(cwd, warm)
  } catch {
    // pre-warming is best-effort
  }
}

let claudeBinaryPath: string | undefined

export function resolveClaudeBinary(): string {
  if (claudeBinaryPath) return claudeBinaryPath
  if (process.env['CLAUDE_BINARY']) {
    claudeBinaryPath = process.env['CLAUDE_BINARY']
    return claudeBinaryPath
  }
  try {
    claudeBinaryPath = execSync('command -v claude', { shell: '/bin/sh', encoding: 'utf8' }).trim()
    return claudeBinaryPath
  } catch {
    throw new Error('Claude CLI not found')
  }
}

export function startChat(req: ChatStartRequest): ChannelId {
  if (!mainWin) throw new Error('No main window set')
  evictIfNeeded()

  const id = randomUUID()
  const channel: Channel = {
    id,
    sessionId: req.sessionId,
    cwd: req.cwd,
    abortController: null,
    partialContent: [],
    activeQuery: null,
    cachedModels: [],
    selectedPermissionMode: req.permissionMode,
  }
  channels.set(id, channel)

  if (!req.skipInitialMessage) {
    runQuery(channel, req.initialMessage, req.sessionId).catch(() => {})
  }

  return id
}

export function sendUserMessage(channelId: ChannelId, text: string): void {
  const channel = channels.get(channelId)
  if (!channel) throw new Error(`Unknown channel ${channelId}`)

  if (channel.abortController) {
    channel.abortController.abort()
    channel.abortController = null
  }

  runQuery(channel, text).catch(() => {})
}

export function stopChat(channelId: ChannelId): void {
  const channel = channels.get(channelId)
  if (!channel) return
  if (channel.abortController) {
    channel.abortController.abort()
    channel.abortController = null
  }
  channels.delete(channelId)
}

export function shutdownAll(): void {
  for (const channel of channels.values()) {
    if (channel.abortController) channel.abortController.abort()
  }
  channels.clear()
  for (const warm of warmQueries.values()) warm.close()
  warmQueries.clear()
}

type SdkSuggestion = { type: string; rules?: { toolName: string; ruleContent?: string }[]; [k: string]: unknown }

function suggestionsLabel(suggestions?: SdkSuggestion[]): string | undefined {
  if (!suggestions?.length) return undefined
  const parts: string[] = []
  for (const s of suggestions) {
    if (s.rules) {
      for (const r of s.rules) {
        const label = r.ruleContent ?? r.toolName
        if (label && !parts.includes(label)) parts.push(label)
      }
    }
  }
  return parts.length > 0 ? parts.join(' & ') : undefined
}

function makeCanUseTool(win: BrowserWindow, channelId: ChannelId) {
  return async (
    toolName: string,
    input: Record<string, unknown>,
    options: {
      signal: AbortSignal
      suggestions?: SdkSuggestion[]
      title?: string
      displayName?: string
      description?: string
    },
  ) => {
    // AskUserQuestion: render a structured question dialog instead of a permission dialog
    if (toolName === 'AskUserQuestion') {
      const requestId = randomUUID()
      const rawQuestions = Array.isArray(input['questions']) ? input['questions'] : []
      const questions = (rawQuestions as Array<Record<string, unknown>>).map((q) => ({
        question: String(q['question'] ?? ''),
        header: String(q['header'] ?? ''),
        options: Array.isArray(q['options'])
          ? (q['options'] as Array<Record<string, unknown>>).map((o) => ({
              label: String(o['label'] ?? ''),
              description: String(o['description'] ?? ''),
              preview: typeof o['preview'] === 'string' ? o['preview'] : undefined,
            }))
          : [],
        multiSelect: q['multiSelect'] === true,
      }))
      const request: AskUserQuestionRequest = { requestId, questions }
      sendChatEvent(win, { kind: 'askUserQuestion', channelId, request })

      const result = await new Promise<{ cancelled: true } | { cancelled: false; answers: Record<string, string>; response?: string }>((resolve) => {
        const onAbort = () => {
          pendingQuestions.delete(requestId)
          resolve({ cancelled: true })
        }
        options.signal.addEventListener('abort', onAbort, { once: true })
        pendingQuestions.set(requestId, {
          resolve: (r) => {
            options.signal.removeEventListener('abort', onAbort)
            resolve(r)
          },
        })
      })

      if (result.cancelled) {
        return { behavior: 'deny' as const, message: 'User cancelled the question dialog' }
      }

      const updatedInput: Record<string, unknown> = {
        ...input,
        answers: result.answers,
      }
      if (result.response !== undefined) updatedInput['response'] = result.response
      return { behavior: 'allow' as const, updatedInput }
    }

    const requestId = randomUUID()
    const request: PermissionRequest = {
      requestId, toolName, input,
      title: options.title,
      sessionPattern: suggestionsLabel(options.suggestions),
    }
    sendChatEvent(win, { kind: 'permissionRequest', channelId, request })
    notifyIfBackground('onPermission', 'ClaudeDance — Permission', `${toolName} requires approval`)

    const result = await new Promise<{ allowed: boolean; mode?: string }>((resolve) => {
      const onAbort = () => {
        pendingPermissions.delete(requestId)
        resolve({ allowed: false })
      }
      options.signal.addEventListener('abort', onAbort, { once: true })
      pendingPermissions.set(requestId, {
        resolve: (allowed, message) => {
          options.signal.removeEventListener('abort', onAbort)
          resolve({ allowed, mode: message })
        },
      })
    })

    if (!result.allowed) {
      return { behavior: 'deny' as const, message: 'User denied' }
    }

    if (result.mode === '__always__' && options.suggestions) {
      return {
        behavior: 'allow' as const,
        updatedPermissions: options.suggestions,
      }
    }

    return { behavior: 'allow' as const }
  }
}

async function runQuery(
  channel: Channel,
  prompt: string,
  resumeSessionId?: string,
): Promise<void> {
  const abortController = new AbortController()
  channel.abortController = abortController
  channel.partialContent = []

  const win = mainWin!
  let q: Query | undefined
  try {
    const warm = warmQueries.get(channel.cwd)
    if (warm) warmQueries.delete(channel.cwd)

    const useWarm = warm && !channel.sessionId && !resumeSessionId && !channel.selectedModel
    if (useWarm) {
      q = warm.query(prompt)
    } else {
      if (warm) warm.close()
      q = query({
        prompt,
        options: {
          cwd: channel.cwd,
          resume: resumeSessionId ?? channel.sessionId,
          pathToClaudeCodeExecutable: resolveClaudeBinary(),
          includePartialMessages: true,
          enableFileCheckpointing: true,
          forwardSubagentText: true,
          abortController,
          model: channel.selectedModel,
          permissionMode: channel.selectedPermissionMode as import('@anthropic-ai/claude-agent-sdk').PermissionMode | undefined,
          allowDangerouslySkipPermissions: channel.selectedPermissionMode === 'bypassPermissions' || undefined,
          settingSources: ['project', 'user'],
          canUseTool: makeCanUseTool(win, channel.id),
        },
      })
    }

    channel.activeQuery = q

    for await (const msg of q) {
      if (win.isDestroyed()) break
      processMessage(channel, msg)
    }
  } catch (err) {
    if (!abortController.signal.aborted && !win.isDestroyed()) {
      const errMsg = String(err)
      sendChatEvent(win, {
        kind: 'error',
        channelId: channel.id,
        message: `SDK error: ${errMsg}`,
      })
      notifyIfBackground('onError', 'ClaudeDance — Error', errMsg)
    }
  } finally {
    if (channel.abortController === abortController) {
      channel.abortController = null
    }
    if (q && channel.activeQuery === q) {
      channel.activeQuery = null
    }
  }
}

function processMessage(channel: Channel, msg: SDKMessage): void {
  const win = mainWin!

  switch (msg.type) {
    case 'system': {
      if (!channel.sessionId && msg.session_id) {
        channel.sessionId = msg.session_id
      }
      if (msg.subtype === 'init') {
        const sysMsg = msg as unknown as Record<string, unknown>
        const model = typeof sysMsg['model'] === 'string' ? (sysMsg['model'] as string) : undefined

        if (channel.activeQuery) {
          channel.activeQuery.supportedCommands().then((cmds) => {
            const commands = cmds.map((c) => ({ name: c.name, description: c.description }))
            sendChatEvent(win, {
              kind: 'slashCommands',
              channelId: channel.id,
              commands,
              model,
            })
          }).catch(() => {
            sendChatEvent(win, { kind: 'slashCommands', channelId: channel.id, commands: [], model })
          })

          if (channel.cachedModels.length === 0) {
            channel.activeQuery.supportedModels().then((models) => {
              channel.cachedModels = models.map((m) => ({
                id: typeof m === 'string' ? m : (m as Record<string, unknown>)['id'] as string ?? String(m),
                name: typeof m === 'string' ? m : (m as Record<string, unknown>)['name'] as string ?? String(m),
              }))
            }).catch(() => {})
          }
        } else {
          sendChatEvent(win, { kind: 'slashCommands', channelId: channel.id, commands: [], model })
        }
      } else if (msg.subtype === 'local_command_output') {
        // CLI-handled slash commands (e.g. /help, /skills, /status, /compact, /usage, etc.)
        // return their output via this message type. Synthesize it as an assistant text event
        // so the renderer can display it normally.
        const text = (msg as unknown as Record<string, unknown>)['content'] as string | undefined
        if (text) {
          const syntheticRaw = {
            type: 'assistant',
            message: {
              role: 'assistant' as const,
              content: [{ type: 'text', text }],
            },
            session_id: msg.session_id,
          }
          const event: import('@shared/types').RawEvent = {
            raw: syntheticRaw,
            kind: 'assistant',
            sessionId: msg.session_id,
          }
          sendChatEvent(win, { kind: 'event', channelId: channel.id, event })
        }
        return
      } else if (msg.subtype === 'commands_changed') {
        // CLI pushed an updated slash-command list (e.g. new skills discovered mid-session)
        const cmds = (msg as unknown as Record<string, unknown>)['commands']
        if (Array.isArray(cmds)) {
          const commands = (cmds as Array<Record<string, unknown>>).map((c) => ({
            name: String(c['name'] ?? ''),
            description: String(c['description'] ?? ''),
          }))
          sendChatEvent(win, { kind: 'slashCommands', channelId: channel.id, commands })
        }
        return
      }

      emitRawEvent(channel, msg, 'system')
      break
    }

    case 'assistant': {
      if (!channel.sessionId && msg.session_id) {
        channel.sessionId = msg.session_id
      }
      channel.partialContent = []
      emitRawEvent(channel, msg, 'assistant')
      break
    }

    case 'result': {
      emitRawEvent(channel, msg, 'result')
      const resultMsg = msg as unknown as Record<string, unknown>
      const body = typeof resultMsg['result'] === 'string'
        ? (resultMsg['result'] as string)
        : 'Task completed'
      notifyIfBackground('onResult', 'ClaudeDance', body)
      break
    }

    case 'stream_event': {
      if (!channel.sessionId && msg.session_id) {
        channel.sessionId = msg.session_id
      }
      handleStreamEvent(channel, msg as SDKPartialAssistantMessage)
      break
    }

    // user / user replay — skip; we inject user events in the renderer store
    case 'user':
      break

    // all other SDK message types: pass through as-is
    default:
      emitRawEvent(channel, msg, msg.type)
      break
  }
}

function emitRawEvent(
  channel: Channel,
  msg: SDKMessage,
  kind: string,
): void {
  const event: RawEvent = {
    raw: msg as unknown as Record<string, unknown>,
    kind,
    sessionId: 'session_id' in msg ? (msg.session_id as string) : undefined,
    timestamp: new Date().toISOString(),
  }
  sendChatEvent(mainWin!, { kind: 'event', channelId: channel.id, event })
}

function handleStreamEvent(channel: Channel, msg: SDKPartialAssistantMessage): void {
  const evt = msg.event as unknown as Record<string, unknown>
  const evtType = evt['type'] as string

  if (evtType === 'content_block_start') {
    const block = evt['content_block'] as Record<string, unknown>
    const index = evt['index'] as number
    channel.partialContent[index] = { ...block } as ContentBlock
  } else if (evtType === 'content_block_delta') {
    const index = evt['index'] as number
    const delta = evt['delta'] as Record<string, unknown>
    const block = channel.partialContent[index]
    if (!block) return

    if (delta['type'] === 'text_delta') {
      block['text'] = ((block['text'] as string) || '') + (delta['text'] as string)
    } else if (delta['type'] === 'input_json_delta') {
      const partialKey = '__partialJson'
      block[partialKey] = ((block[partialKey] as string) || '') + (delta['partial_json'] as string)
      try {
        block['input'] = JSON.parse(block[partialKey] as string)
      } catch {
        // JSON not complete yet
      }
    }
  } else {
    return
  }

  const cleanContent = channel.partialContent
    .filter(Boolean)
    .map((b) => {
      const { __partialJson: _, ...clean } = b
      return clean
    })

  const syntheticRaw = {
    type: 'assistant',
    message: {
      role: 'assistant' as const,
      content: cleanContent,
    },
    session_id: msg.session_id,
  }

  const event: RawEvent = {
    raw: syntheticRaw,
    kind: 'assistant',
    sessionId: msg.session_id,
  }
  sendChatEvent(mainWin!, { kind: 'event', channelId: channel.id, event })
}

function evictIfNeeded(): void {
  if (channels.size < MAX_CHANNELS) return
  const oldest = channels.keys().next().value
  if (oldest) stopChat(oldest)
}

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import type { ChannelId, ChatStartRequest, RawEvent } from '@shared/types'
import { sendChatEvent } from './ipc-utils'

type Channel = {
  id: ChannelId
  proc: ChildProcessWithoutNullStreams
  buffer: string
  sessionId?: string
}

const MAX_CHANNELS = 3
const channels = new Map<ChannelId, Channel>()

export function startChat(win: BrowserWindow, req: ChatStartRequest): ChannelId {
  evictIfNeeded(win)

  const args = [
    '--print',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--include-partial-messages',
    '--include-hook-events',
    '--verbose',
  ]
  if (req.sessionId) args.push('--resume', req.sessionId)

  let proc: ChildProcessWithoutNullStreams
  const id = randomUUID()
  try {
    proc = spawn('claude', args, {
      cwd: req.cwd,
      env: { ...process.env },
    })
  } catch (err) {
    sendChatEvent(win, {
      kind: 'error',
      channelId: id,
      message: `Failed to spawn claude: ${String(err)}`,
    })
    sendChatEvent(win, { kind: 'exit', channelId: id, code: null })
    return id
  }

  const channel: Channel = { id, proc, buffer: '', sessionId: req.sessionId }
  channels.set(id, channel)

  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (chunk: string) => {
    channel.buffer += chunk
    let nl: number
    while ((nl = channel.buffer.indexOf('\n')) !== -1) {
      const line = channel.buffer.slice(0, nl)
      channel.buffer = channel.buffer.slice(nl + 1)
      if (!line.trim()) continue
      try {
        const raw = JSON.parse(line) as Record<string, unknown>
        const event: RawEvent = {
          raw,
          kind: typeof raw['type'] === 'string' ? (raw['type'] as string) : 'unknown',
          sessionId:
            typeof raw['session_id'] === 'string'
              ? (raw['session_id'] as string)
              : typeof raw['sessionId'] === 'string'
                ? (raw['sessionId'] as string)
                : undefined,
          timestamp: typeof raw['timestamp'] === 'string' ? (raw['timestamp'] as string) : undefined,
        }
        if (!channel.sessionId && event.sessionId) channel.sessionId = event.sessionId
        sendChatEvent(win, { kind: 'event', channelId: id, event })
      } catch (err) {
        sendChatEvent(win, {
          kind: 'error',
          channelId: id,
          message: `Failed to parse line: ${String(err)}`,
        })
      }
    }
  })

  proc.stderr.setEncoding('utf8')
  proc.stderr.on('data', (chunk: string) => {
    sendChatEvent(win, { kind: 'error', channelId: id, message: chunk })
  })

  proc.on('exit', (code) => {
    sendChatEvent(win, { kind: 'exit', channelId: id, code })
    channels.delete(id)
  })

  proc.on('error', (err) => {
    sendChatEvent(win, { kind: 'error', channelId: id, message: err.message })
  })

  sendUserMessage(id, req.initialMessage)
  return id
}

export function sendUserMessage(channelId: ChannelId, text: string): void {
  const channel = channels.get(channelId)
  if (!channel) throw new Error(`Unknown channel ${channelId}`)
  const payload = {
    type: 'user',
    message: { role: 'user', content: text },
  }
  channel.proc.stdin.write(JSON.stringify(payload) + '\n')
}

export function stopChat(channelId: ChannelId): void {
  const channel = channels.get(channelId)
  if (!channel) return
  channel.proc.kill('SIGTERM')
  channels.delete(channelId)
}

export function shutdownAll(): void {
  for (const c of channels.values()) c.proc.kill('SIGTERM')
  channels.clear()
}

function evictIfNeeded(_win: BrowserWindow): void {
  if (channels.size < MAX_CHANNELS) return
  const oldest = channels.keys().next().value
  if (oldest) stopChat(oldest)
}

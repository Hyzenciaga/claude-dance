export type Project = {
  path: string
  encodedPath: string
  exists: boolean
  sessionCount: number
  lastActiveAt: number
  source: 'scanned' | 'manual'
  hidden: boolean
}

export type SessionSummary = {
  id: string
  projectPath: string
  jsonlPath: string
  title: string
  firstMessageAt: number
  lastMessageAt: number
  messageCount: number
}

export type RawEvent = {
  raw: Record<string, unknown>
  kind: string
  sessionId?: string
  timestamp?: string
}

export type ChannelId = string

export type ChatStartRequest = {
  cwd: string
  sessionId?: string
  initialMessage: string
}

export type ChatStartResponse = {
  channelId: ChannelId
}

export type IpcChatEvent =
  | { kind: 'event'; channelId: ChannelId; event: RawEvent }
  | { kind: 'exit'; channelId: ChannelId; code: number | null }
  | { kind: 'error'; channelId: ChannelId; message: string }

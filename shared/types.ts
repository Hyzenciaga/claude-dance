export type Project = {
  path: string
  encodedPath: string
  exists: boolean
  sessionCount: number
  lastActiveAt: number
  source: 'scanned' | 'manual'
  hidden: boolean
  archived: boolean
}

export type SessionSummary = {
  id: string
  projectPath: string
  title: string
  firstMessageAt: number
  lastMessageAt: number
  messageCount: number
  archived: boolean
}

export type RawEvent = {
  raw: Record<string, unknown>
  kind: string
  sessionId?: string
  timestamp?: string
}

export type ChannelId = string

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto'

export type ChatStartRequest = {
  cwd: string
  sessionId?: string
  initialMessage: string
  skipInitialMessage?: boolean
  permissionMode?: PermissionMode
}

export type ChatStartResponse = {
  channelId: ChannelId
}

export type PermissionRequest = {
  requestId: string
  toolName: string
  input: Record<string, unknown>
  title?: string
  sessionPattern?: string
}

export type CommandInfo = {
  name: string
  description: string
}

export type QuestionOption = {
  label: string
  description: string
  preview?: string
}

export type AskQuestion = {
  question: string
  header: string
  options: QuestionOption[]
  multiSelect: boolean
}

export type AskUserQuestionRequest = {
  requestId: string
  questions: AskQuestion[]
}

export type IpcChatEvent =
  | { kind: 'event'; channelId: ChannelId; event: RawEvent }
  | { kind: 'exit'; channelId: ChannelId; code: number | null }
  | { kind: 'error'; channelId: ChannelId; message: string }
  | { kind: 'slashCommands'; channelId: ChannelId; commands: CommandInfo[]; model?: string; version?: string }
  | { kind: 'permissionRequest'; channelId: ChannelId; request: PermissionRequest }
  | { kind: 'askUserQuestion'; channelId: ChannelId; request: AskUserQuestionRequest }

export type NoteScope = 'session' | 'project'

export type NoteItem = {
  id: string
  done: boolean
  text: string
  parentId?: string
}

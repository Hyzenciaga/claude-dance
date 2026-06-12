# Claude Agent SDK — TypeScript Reference

> Package: `@anthropic-ai/claude-agent-sdk` v0.3.170+
> Type: Pure ESM (`type: "module"`)
> Peer deps: `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `zod@^4`

---

## Core Functions

### `query()`

Primary function. Returns an async generator that streams `SDKMessage` events.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'

const q = query({
  prompt: 'Hello',                    // string or AsyncIterable<SDKUserMessage>
  options: {
    cwd: '/path/to/project',
    pathToClaudeCodeExecutable: '/usr/local/bin/claude',
    resume: 'session-uuid',           // resume existing session
    includePartialMessages: true,     // stream partial assistant chunks
    model: 'claude-sonnet-4-5-20250929',
    // ... see Options below
  }
})

for await (const msg of q) {
  console.log(msg.type, msg)
}
```

### `startup()`

Pre-warms a Claude subprocess for faster first query.

```typescript
import { startup } from '@anthropic-ai/claude-agent-sdk'

const warm = startup({
  cwd: '/path/to/project',
  pathToClaudeCodeExecutable: '/usr/local/bin/claude',
})

// Later, pass to query:
const q = query({ prompt: 'Hi', options: { warmQuery: warm } })
```

---

## Query Object Methods

The `Query` object extends `AsyncGenerator<SDKMessage, void>`:

| Method | Returns | Description |
|--------|---------|-------------|
| `interrupt()` | `Promise<void>` | Interrupt current operation |
| `rewindFiles(userMessageUuid)` | `Promise<void>` | Rewind files to checkpoint |
| `setPermissionMode(mode)` | `Promise<void>` | Change permission mode at runtime |
| `setModel(model?)` | `Promise<void>` | Switch model mid-conversation |
| `setMaxThinkingTokens(n)` | `Promise<void>` | Set thinking budget |
| `supportedCommands()` | `Promise<SlashCommand[]>` | List available slash commands |
| `supportedModels()` | `Promise<ModelInfo[]>` | List available models |
| `mcpServerStatus()` | `Promise<McpServerStatus[]>` | MCP server connection status |
| `accountInfo()` | `Promise<AccountInfo>` | Account/billing info |

---

## Options

Full options for `query()`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cwd` | `string` | `process.cwd()` | Working directory |
| `pathToClaudeCodeExecutable` | `string` | built-in | Path to `claude` binary |
| `resume` | `string` | — | Session ID to resume |
| `forkSession` | `boolean` | `false` | Fork instead of continuing session |
| `continue` | `boolean` | `false` | Continue most recent conversation |
| `model` | `string` | CLI default | Claude model |
| `fallbackModel` | `string` | — | Fallback if primary fails |
| `includePartialMessages` | `boolean` | `false` | Stream partial chunks |
| `enableFileCheckpointing` | `boolean` | `false` | Enable file rewind support |
| `maxTurns` | `number` | — | Max conversation turns |
| `maxBudgetUsd` | `number` | — | Budget cap in USD |
| `maxThinkingTokens` | `number` | — | Thinking token limit |
| `permissionMode` | `PermissionMode` | `'default'` | Permission handling mode |
| `canUseTool` | `CanUseTool` | — | Custom permission callback |
| `allowedTools` | `string[]` | all | Whitelist tools |
| `disallowedTools` | `string[]` | `[]` | Blacklist tools |
| `allowDangerouslySkipPermissions` | `boolean` | `false` | Required for `bypassPermissions` |
| `additionalDirectories` | `string[]` | `[]` | Extra accessible directories |
| `mcpServers` | `Record<string, McpServerConfig>` | `{}` | MCP server configs |
| `strictMcpConfig` | `boolean` | `false` | Strict MCP validation |
| `agents` | `Record<string, AgentDefinition>` | — | Programmatic subagents |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | `{}` | Event hook callbacks |
| `systemPrompt` | `string \| { type: 'preset'; preset: 'claude_code'; append?: string }` | — | System prompt config |
| `tools` | `string[] \| { type: 'preset'; preset: 'claude_code' }` | — | Tool configuration |
| `settingSources` | `SettingSource[]` | `[]` | Filesystem settings to load |
| `env` | `Dict<string>` | `process.env` | Environment variables |
| `abortController` | `AbortController` | new | Cancellation controller |
| `stderr` | `(data: string) => void` | — | Stderr callback |
| `outputFormat` | `{ type: 'json_schema'; schema: JSONSchema }` | — | Structured output schema |
| `sandbox` | `SandboxSettings` | — | Sandbox config |
| `plugins` | `SdkPluginConfig[]` | `[]` | Custom plugins |
| `betas` | `SdkBeta[]` | `[]` | Beta features |
| `executable` | `'bun' \| 'deno' \| 'node'` | auto | JS runtime |
| `executableArgs` | `string[]` | `[]` | Runtime args |
| `extraArgs` | `Record<string, string \| null>` | `{}` | Additional args |

---

## SDKMessage Types

Union type of all messages from `query()`:

```typescript
type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage
```

### SDKAssistantMessage

```typescript
type SDKAssistantMessage = {
  type: 'assistant'
  uuid: UUID
  session_id: string
  message: APIAssistantMessage   // BetaMessage from @anthropic-ai/sdk
  parent_tool_use_id: string | null
}
```

`message.content` is `ContentBlock[]` containing `{type:'text', text:string}` and `{type:'tool_use', id, name, input}` blocks — identical to current CLI JSON output format.

### SDKUserMessage

```typescript
type SDKUserMessage = {
  type: 'user'
  uuid?: UUID
  session_id: string
  message: APIUserMessage
  parent_tool_use_id: string | null
}
```

### SDKResultMessage

```typescript
type SDKResultMessage =
  | {
      type: 'result'
      subtype: 'success'
      uuid: UUID
      session_id: string
      duration_ms: number
      duration_api_ms: number
      is_error: boolean
      num_turns: number
      result: string
      total_cost_usd: number
      usage: NonNullableUsage
      modelUsage: { [modelName: string]: ModelUsage }
      permission_denials: SDKPermissionDenial[]
      structured_output?: unknown
    }
  | {
      type: 'result'
      subtype: 'error_max_turns' | 'error_during_execution' | 'error_max_budget_usd' | 'error_max_structured_output_retries'
      uuid: UUID
      session_id: string
      duration_ms: number
      duration_api_ms: number
      is_error: boolean
      num_turns: number
      total_cost_usd: number
      usage: NonNullableUsage
      modelUsage: { [modelName: string]: ModelUsage }
      permission_denials: SDKPermissionDenial[]
      errors: string[]
    }
```

### SDKSystemMessage

```typescript
type SDKSystemMessage = {
  type: 'system'
  subtype: 'init'
  uuid: UUID
  session_id: string
  apiKeySource: ApiKeySource
  cwd: string
  tools: string[]
  mcp_servers: { name: string; status: string }[]
  model: string
  permissionMode: PermissionMode
  slash_commands: string[]
  output_style: string
}
```

### SDKPartialAssistantMessage

Only emitted when `includePartialMessages: true`:

```typescript
type SDKPartialAssistantMessage = {
  type: 'stream_event'
  event: RawMessageStreamEvent   // from @anthropic-ai/sdk
  parent_tool_use_id: string | null
  uuid: UUID
  session_id: string
}
```

### SDKCompactBoundaryMessage

```typescript
type SDKCompactBoundaryMessage = {
  type: 'system'
  subtype: 'compact_boundary'
  uuid: UUID
  session_id: string
  compact_metadata: {
    trigger: 'manual' | 'auto'
    pre_tokens: number
  }
}
```

---

## Permission System

### CanUseTool Callback

```typescript
type CanUseTool = (
  toolName: string,
  input: ToolInput,
  options: {
    signal: AbortSignal
    suggestions?: PermissionUpdate[]
  }
) => Promise<PermissionResult>
```

### PermissionResult

```typescript
type PermissionResult =
  | { behavior: 'allow'; updatedInput?: ToolInput }
  | { behavior: 'deny'; message?: string }
  | { behavior: 'allowWithEdits'; updatedInput: ToolInput }
```

### PermissionMode

```typescript
type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
```

---

## Common Patterns

### Multi-turn via resume

Each `query()` is one prompt → full response. For multi-turn, resume the session:

```typescript
// First turn
const q1 = query({ prompt: 'Hello', options: { cwd: '/project' } })
let sessionId: string
for await (const msg of q1) {
  if (msg.session_id) sessionId = msg.session_id
}

// Second turn — resume same session
const q2 = query({
  prompt: 'Follow up question',
  options: { cwd: '/project', resume: sessionId }
})
for await (const msg of q2) { /* ... */ }
```

### Multi-turn via AsyncIterable prompt

Alternative: single `query()` with streaming input:

```typescript
async function* userMessages(): AsyncIterable<SDKUserMessage> {
  yield {
    type: 'user',
    session_id: '',
    message: { role: 'user', content: [{ type: 'text', text: 'First message' }] },
    parent_tool_use_id: null,
  }
  // yield more messages as needed
}

const q = query({ prompt: userMessages(), options: { cwd: '/project' } })
for await (const msg of q) { /* ... */ }
```

### Permission callback (GUI integration)

```typescript
const q = query({
  prompt: 'Edit my files',
  options: {
    canUseTool: async (toolName, input, { signal }) => {
      // Show UI dialog, wait for user response
      const allowed = await showPermissionDialog(toolName, input, signal)
      return allowed
        ? { behavior: 'allow' }
        : { behavior: 'deny', message: 'User denied' }
    }
  }
})
```

### Subprocess pre-warming

```typescript
import { startup } from '@anthropic-ai/claude-agent-sdk'

const warm = startup({ cwd: '/project', pathToClaudeCodeExecutable: '/usr/local/bin/claude' })
// ... later, when user sends first message:
const q = query({ prompt: text, options: { warmQuery: warm } })
```

---

## Package Exports

```
@anthropic-ai/claude-agent-sdk        → sdk.mjs (main entry)
@anthropic-ai/claude-agent-sdk/browser → browser-sdk.js
@anthropic-ai/claude-agent-sdk/bridge  → bridge.mjs
@anthropic-ai/claude-agent-sdk/assistant → assistant.mjs
@anthropic-ai/claude-agent-sdk/extract → extractFromBunfs.js
```

---

## Key Insight for ClaudeDance Migration

`SDKAssistantMessage.message` is `BetaMessage` from `@anthropic-ai/sdk`, which contains `content: ContentBlock[]` with `{type:'text'}` and `{type:'tool_use'}` blocks. This is **identical** to the JSON structure our CLI subprocess currently emits, meaning `derive.ts` (which transforms raw events into rendered messages) requires **zero changes**.

The adapter layer (`sdk-adapter.ts`) only needs to wrap SDK messages into our existing `IpcChatEvent` format.

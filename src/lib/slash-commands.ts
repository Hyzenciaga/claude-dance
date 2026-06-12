import type { CommandInfo } from '@shared/types'

export type SlashCommand = {
  command: string
  description: string
}

const BUILTIN_COMMANDS: CommandInfo[] = [
  // Session & Navigation
  { name: 'help', description: 'Show help and available commands' },
  { name: 'clear', description: 'Start a new conversation with empty context' },
  { name: 'resume', description: 'Resume a conversation by ID or name' },
  { name: 'branch', description: 'Create a branch of the current conversation' },
  { name: 'fork', description: 'Spawn a forked subagent that inherits the conversation' },
  { name: 'exit', description: 'Exit the CLI' },
  { name: 'rename', description: 'Rename the current session' },
  { name: 'rewind', description: 'Rewind conversation and/or code to a previous checkpoint' },
  { name: 'compact', description: 'Free up context by summarizing the conversation' },
  { name: 'context', description: 'Visualize current context usage' },
  { name: 'recap', description: 'Generate a one-line summary of the current session' },
  { name: 'copy', description: 'Copy the last assistant response to clipboard' },
  { name: 'export', description: 'Export the current conversation as plain text' },
  { name: 'cd', description: 'Move this session to a new working directory' },
  { name: 'add-dir', description: 'Add a working directory for file access' },
  { name: 'btw', description: 'Ask a quick side question without adding to the conversation' },
  // Model & Effort
  { name: 'model', description: 'Switch the AI model' },
  { name: 'effort', description: 'Set the model effort level' },
  { name: 'fast', description: 'Toggle fast mode on or off' },
  { name: 'advisor', description: 'Enable or disable the advisor tool' },
  // Permissions & Configuration
  { name: 'config', description: 'Open the Settings interface' },
  { name: 'permissions', description: 'Manage allow/ask/deny rules for tool permissions' },
  { name: 'hooks', description: 'View hook configurations for tool events' },
  { name: 'keybindings', description: 'Open your keyboard shortcuts file' },
  { name: 'privacy-settings', description: 'View and update privacy settings' },
  // Costs & Usage
  { name: 'usage', description: 'Show session cost, plan usage limits, and activity stats' },
  { name: 'cost', description: 'Show session cost and usage' },
  { name: 'upgrade', description: 'Open the upgrade page' },
  // Authentication
  { name: 'login', description: 'Sign in to your Anthropic account' },
  { name: 'logout', description: 'Sign out from your Anthropic account' },
  // Code Review & Diffs
  { name: 'diff', description: 'Open interactive diff viewer showing uncommitted changes' },
  { name: 'review', description: 'Review a pull request locally' },
  { name: 'code-review', description: 'Review current diff for correctness bugs and cleanups' },
  { name: 'simplify', description: 'Review changed code for cleanup opportunities' },
  { name: 'security-review', description: 'Analyze pending changes for security vulnerabilities' },
  // Project Setup & Diagnostics
  { name: 'init', description: 'Initialize project with a CLAUDE.md guide' },
  { name: 'memory', description: 'Edit CLAUDE.md memory files' },
  { name: 'doctor', description: 'Diagnose and verify Claude Code installation' },
  { name: 'debug', description: 'Enable debug logging and troubleshoot issues' },
  { name: 'feedback', description: 'Submit feedback or report a bug' },
  { name: 'status', description: 'Show version, model, account status' },
  { name: 'release-notes', description: 'View the changelog' },
  { name: 'insights', description: 'Generate a report analyzing your sessions' },
  // Plugins & Skills & MCP
  { name: 'plugin', description: 'Manage Claude Code plugins' },
  { name: 'reload-plugins', description: 'Reload all active plugins' },
  { name: 'reload-skills', description: 'Re-scan skill directories for changes' },
  { name: 'skills', description: 'List available skills' },
  { name: 'mcp', description: 'Manage MCP server connections' },
  // Agents & Background Tasks
  { name: 'agents', description: 'Manage agent configurations' },
  { name: 'background', description: 'Detach session to run as background agent' },
  { name: 'tasks', description: 'View and manage background tasks' },
  { name: 'stop', description: 'Stop the current background session' },
  { name: 'goal', description: 'Set a goal: Claude keeps working until condition is met' },
  { name: 'loop', description: 'Run a prompt repeatedly on a schedule' },
  // Terminal UI & Appearance
  { name: 'theme', description: 'Change the color theme' },
  { name: 'vim', description: 'Toggle Vim editing mode' },
  // Cross-device & Remote
  { name: 'remote-control', description: 'Make session available for remote control' },
  { name: 'desktop', description: 'Continue current session in the Desktop app' },
  { name: 'teleport', description: 'Pull a web session into this terminal' },
  // Workflows & Planning
  { name: 'plan', description: 'Enter plan mode directly from the prompt' },
  // Setup & Integrations
  { name: 'terminal-setup', description: 'Configure terminal keybindings' },
  { name: 'ide', description: 'Manage IDE integrations and show status' },
  { name: 'install-github-app', description: 'Set up the Claude GitHub Actions app' },
]

export function toSlashCommands(commands?: CommandInfo[]): SlashCommand[] {
  const result: CommandInfo[] = commands ? [...commands] : []
  const seen = new Set(result.map((c) => c.name))
  for (const builtin of BUILTIN_COMMANDS) {
    if (!seen.has(builtin.name)) {
      result.push(builtin)
    }
  }
  return result.map((c) => ({ command: '/' + c.name, description: c.description }))
}

export function filterCommands(
  query: string,
  allCommands: SlashCommand[],
): SlashCommand[] {
  const q = query.toLowerCase()
  return allCommands.filter((c) => c.command.slice(1).toLowerCase().startsWith(q))
}

import { execSync } from 'node:child_process'

/**
 * Packaged Electron apps inherit PATH from macOS' launchd GUI session, which
 * lacks anything users add in .zshrc / .bashrc / nvm / brew shellenv. Resolve
 * the real PATH by asking the user's login shell once at startup, then merge
 * it into process.env so every subsequent spawn() sees it.
 *
 * Cheap (~30ms one-time) and works for zsh, bash, fish.
 */
export function hydrateShellPath(): void {
  if (process.platform === 'win32') return
  const shell = process.env['SHELL'] || '/bin/zsh'
  try {
    const out = execSync(`${shell} -l -i -c 'echo __CD_PATH__:$PATH'`, {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const m = out.match(/__CD_PATH__:(.+)/)
    if (m && m[1]) {
      const resolved = m[1].trim()
      if (resolved.length > 0) {
        process.env['PATH'] = resolved
      }
    }
  } catch {
    // Fall back silently — checkClaudeBinary will surface the missing-cli
    // dialog with a more user-actionable message.
  }
}

type LocalResult = {
  handled: boolean
  response?: string
  navigate?: 'settings' | 'rewind'
}

export function handleLocalCommand(
  text: string,
  _ctx: Record<string, unknown>,
): LocalResult {
  const trimmed = text.trim()
  const cmd = trimmed.split(/\s/)[0].toLowerCase()

  switch (cmd) {
    case '/config':
    case '/settings': return { handled: true, navigate: 'settings' }
    case '/rewind': return { handled: true, navigate: 'rewind' }
    default: return { handled: false }
  }
}

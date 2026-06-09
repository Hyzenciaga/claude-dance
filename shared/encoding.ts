export function encodeCwd(cwd: string): string {
  const trimmed = cwd.length > 1 && cwd.endsWith('/') ? cwd.slice(0, -1) : cwd
  return trimmed.replace(/\//g, '-')
}

export function decodeCwd(encoded: string): string {
  return encoded.replace(/-/g, '/')
}

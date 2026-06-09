export function encodeCwd(cwd: string): string {
  const trimmed = cwd.length > 1 && cwd.endsWith('/') ? cwd.slice(0, -1) : cwd
  return trimmed.replace(/\//g, '-')
}

/**
 * Lossy: paths containing literal '-' cannot be recovered.
 * Used as a best-effort fallback; prefer reading the `cwd` field from the first jsonl event when possible.
 */
export function decodeCwd(encoded: string): string {
  return encoded.replace(/-/g, '/')
}

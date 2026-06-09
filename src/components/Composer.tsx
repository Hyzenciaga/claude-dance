import { useState, useEffect } from 'react'
import { useProjects } from '../store/projects'

type Props = {
  // If cwdLocked is set, hide the picker and use that cwd
  cwdLocked?: string
  // If unlocked, optional preselected project from sidebar "+" click
  initialCwd?: string
  onSubmit: (text: string, cwd: string) => void
  disabled?: boolean
}

export function Composer({ cwdLocked, initialCwd, onSubmit, disabled }: Props) {
  const { projects } = useProjects()
  const defaultCwd =
    cwdLocked ??
    initialCwd ??
    projects
      .filter((p) => !p.hidden && p.exists)
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0]?.path ??
    ''
  const [cwd, setCwd] = useState(defaultCwd)
  const [text, setText] = useState('')

  useEffect(() => {
    if (!cwdLocked) setCwd(defaultCwd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCwd])

  function submit() {
    if (!text.trim()) return
    const effective = cwdLocked ?? cwd
    if (!effective) return
    onSubmit(text, effective)
    setText('')
  }

  return (
    <div className="border-t border-border p-3 bg-background">
      {!cwdLocked && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>📁</span>
          <select
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            className="border border-border rounded px-2 py-1 bg-background text-xs flex-1 max-w-md"
          >
            {projects
              .filter((p) => !p.hidden)
              .map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          disabled={disabled}
          rows={3}
          placeholder="Type a message — Enter to send, Shift+Enter for newline"
          className="flex-1 border border-border rounded px-3 py-2 text-sm resize-none bg-background"
        />
        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="self-end px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}

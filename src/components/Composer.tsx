import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react'
import { ArrowUp, NotebookPen, Square } from 'lucide-react'
import { useProjects } from '../store/projects'
import { filterCommands, toSlashCommands } from '../lib/slash-commands'
import { SlashMenu } from './SlashMenu'
import { PermissionModeSelector } from './PermissionModeSelector'
import { ModelSelector } from './ModelSelector'
import type { CommandInfo } from '@shared/types'

type Props = {
  cwdLocked?: string
  initialCwd?: string
  onSubmit: (text: string, cwd: string) => void
  onStop?: () => void
  onCutToNotes?: (text: string) => void
  disabled?: boolean
  running?: boolean
  prefill?: { text: string; nonce: number; replace?: boolean } | null
  availableCommands?: CommandInfo[]
  initialDraft?: string
  onDraftChange?: (text: string) => void
  channelId?: string
  model?: string
  permissionMode?: string
  onPermissionModeChange?: (mode: string) => void
}

export function Composer({
  cwdLocked,
  initialCwd,
  onSubmit,
  onStop,
  onCutToNotes,
  disabled,
  running,
  prefill,
  availableCommands,
  initialDraft,
  onDraftChange,
  channelId,
  model,
  permissionMode,
  onPermissionModeChange,
}: Props) {
  const { projects } = useProjects()
  const defaultCwd =
    cwdLocked ??
    initialCwd ??
    projects.filter((p) => !p.hidden && p.exists).sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0]
      ?.path ??
    ''
  const [cwd, setCwd] = useState(defaultCwd)
  const [text, _setText] = useState(initialDraft ?? '')
  function setText(v: string | ((prev: string) => string)) {
    _setText((prev) => {
      const next = typeof v === 'function' ? v(prev) : v
      if (next !== prev) onDraftChange?.(next)
      return next
    })
  }
  const [slashQuery, setSlashQuery] = useState<string | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)

  const allCommands = useMemo(
    () => toSlashCommands(availableCommands),
    [availableCommands],
  )
  const slashResults = useMemo(
    () => (slashQuery !== null ? filterCommands(slashQuery, allCommands) : []),
    [slashQuery, allCommands],
  )
  const slashOpen = slashQuery !== null && slashResults.length > 0

  useEffect(() => {
    if (!cwdLocked) setCwd(defaultCwd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCwd])

  useLayoutEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [text])

  useEffect(() => {
    if (!prefill) return
    if (prefill.replace) {
      setText(prefill.text)
    } else {
      setText((prev) => {
        const sep = prev.length > 0 && !prev.endsWith('\n') && !prev.endsWith(' ') ? ' ' : ''
        return prev + sep + prefill.text
      })
    }
    requestAnimationFrame(() => {
      const el = taRef.current
      if (!el) return
      el.focus()
      const end = el.value.length
      el.setSelectionRange(end, end)
    })
  }, [prefill])

  function cutToNotes() {
    if (!onCutToNotes) return
    const t = text.trim()
    if (!t) return
    onCutToNotes(t)
    setText('')
  }

  function submit() {
    if (!text.trim()) return
    const effective = cwdLocked ?? cwd
    if (!effective) return
    onSubmit(text, effective)
    setText('')
  }

  return (
    <div className="px-6 pb-5 pt-1">
      <div className="mx-auto max-w-4xl">
        <div
          className="relative rounded-2xl bg-bg-inset border border-line/80
                     focus-within:border-line-strong transition-colors"
        >
        {slashOpen && (
          <SlashMenu
            commands={slashResults}
            activeIndex={slashIndex}
            onSelect={(cmd) => {
              setText(cmd.command + ' ')
              setSlashQuery(null)
              taRef.current?.focus()
            }}
          />
        )}
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            const val = e.target.value
            setText(val)
            if (val.startsWith('/')) {
              const query = val.slice(1).split(/\s/)[0]
              if (val.indexOf(' ') === -1) {
                setSlashQuery(query)
                setSlashIndex(0)
              } else {
                setSlashQuery(null)
              }
            } else {
              setSlashQuery(null)
            }
          }}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => {
            requestAnimationFrame(() => { composingRef.current = false })
          }}
          onKeyDown={(e) => {
            if (slashOpen) {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSlashIndex((i) => (i + 1) % slashResults.length)
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSlashIndex((i) => (i - 1 + slashResults.length) % slashResults.length)
                return
              }
              if (e.key === 'Tab') {
                e.preventDefault()
                const cmd = slashResults[slashIndex]
                if (cmd) {
                  setText(cmd.command + ' ')
                  setSlashQuery(null)
                }
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setSlashQuery(null)
                return
              }
            }

            if (e.key !== 'Enter') return
            const native = e.nativeEvent as KeyboardEvent
            if (composingRef.current || native.isComposing || native.keyCode === 229) return

            if (slashOpen) {
              e.preventDefault()
              const cmd = slashResults[slashIndex]
              if (cmd) {
                setText(cmd.command + ' ')
                setSlashQuery(null)
              }
              return
            }

            // ⌘+Shift+Enter → cut to notes
            if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
              e.preventDefault()
              cutToNotes()
              return
            }

            // Shift+Enter → newline (default browser behavior, don't prevent)
            if (e.shiftKey) return

            // Enter → send
            e.preventDefault()
            submit()
          }}
          disabled={disabled}
          rows={1}
          placeholder="Send a message…"
          className="w-full resize-none bg-transparent px-3.5 pt-3 pb-1.5
                     text-[13.5px] leading-[1.5] placeholder:text-fg-subtle"
        />
        <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-line/60">
          {/* Left: permission mode + model selectors */}
          <div className="flex items-center gap-1">
            <PermissionModeSelector
              channelId={channelId}
              currentMode={permissionMode}
              onLocalChange={onPermissionModeChange}
            />
            {channelId && (
              <ModelSelector channelId={channelId} currentModel={model} />
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onCutToNotes && (
              <button
                onClick={cutToNotes}
                disabled={!text.trim()}
                title="Move to notes (⌘⇧↵)"
                aria-label="Move input to notes"
                className="h-6 w-6 flex items-center justify-center rounded-lg
                           text-fg-subtle hover:text-fg-default hover:bg-bg-hover
                           disabled:text-fg-faint disabled:cursor-not-allowed disabled:hover:bg-transparent
                           transition-colors"
              >
                <NotebookPen size={13} strokeWidth={2} />
              </button>
            )}
            {running ? (
              <button
                onClick={onStop}
                className="h-6 w-6 flex items-center justify-center rounded-lg
                           bg-red-500 text-white hover:bg-red-600
                           transition-colors"
                aria-label="Stop"
                title="Stop Claude"
              >
                <Square size={10} strokeWidth={0} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={disabled || !text.trim()}
                className="h-6 w-6 flex items-center justify-center rounded-lg
                           bg-fg-default text-bg-base hover:bg-fg-muted
                           disabled:bg-bg-hover disabled:text-fg-faint disabled:cursor-not-allowed
                           transition-colors"
                aria-label="Send"
              >
                <ArrowUp size={13} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}

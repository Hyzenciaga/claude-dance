import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, FolderOpen, ArrowUp, NotebookPen } from 'lucide-react'
import { useProjects } from '../store/projects'

type Props = {
  cwdLocked?: string
  initialCwd?: string
  onSubmit: (text: string, cwd: string) => void
  onCutToNotes?: (text: string) => void
  disabled?: boolean
  prefill?: { text: string; nonce: number } | null
}

export function Composer({ cwdLocked, initialCwd, onSubmit, onCutToNotes, disabled, prefill }: Props) {
  const { projects } = useProjects()
  const defaultCwd =
    cwdLocked ??
    initialCwd ??
    projects.filter((p) => !p.hidden && p.exists).sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0]
      ?.path ??
    ''
  const [cwd, setCwd] = useState(defaultCwd)
  const [text, setText] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)

  useEffect(() => {
    if (!cwdLocked) setCwd(defaultCwd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCwd])

  // Auto-grow textarea up to ~8 lines
  useLayoutEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [text])

  // Refill from notes: append to textarea, focus, place caret at end.
  // Keyed by nonce so re-clicking the same note re-fires.
  useEffect(() => {
    if (!prefill) return
    setText((prev) => {
      const sep = prev.length > 0 && !prev.endsWith('\n') && !prev.endsWith(' ') ? ' ' : ''
      return prev + sep + prefill.text
    })
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

  const effective = cwdLocked ?? cwd
  const cwdLabel = effective.split('/').pop() || effective || 'No directory'

  return (
    <div className="px-6 pb-5 pt-1">
      <div
        className="relative rounded-xl bg-bg-inset border border-line/80
                   focus-within:border-line-strong transition-colors"
      >
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => {
            // Stay "composing" for one tick so the Enter that commits IME
            // doesn't immediately trigger submit on browsers that fire
            // keydown after compositionend.
            requestAnimationFrame(() => { composingRef.current = false })
          }}
          onKeyDown={(e) => {
            // Native IME path: most browsers report keyCode 229 while composing.
            // Belt-and-suspenders: also check React's nativeEvent.isComposing
            // and our composingRef flag.
            if (e.key !== 'Enter') return
            if (e.shiftKey) return
            const native = e.nativeEvent as KeyboardEvent
            if (
              composingRef.current ||
              native.isComposing ||
              native.keyCode === 229
            ) {
              return
            }
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
          {cwdLocked ? (
            <div className="flex items-center gap-1.5 text-[11.5px] text-fg-subtle px-1.5 py-0.5">
              <FolderOpen size={11} />
              <span className="font-mono truncate max-w-[360px]" title={cwdLocked}>
                {cwdLabel}
              </span>
            </div>
          ) : (
            <Select.Root value={cwd} onValueChange={setCwd}>
              <Select.Trigger
                className="flex items-center gap-1.5 px-1.5 py-0.5 rounded
                           text-[11.5px] text-fg-subtle hover:text-fg-default
                           hover:bg-bg-hover/60 transition-colors"
              >
                <FolderOpen size={11} />
                <Select.Value>
                  <span className="font-mono">{cwdLabel}</span>
                </Select.Value>
                <ChevronDown size={11} className="opacity-60" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="z-50 bg-bg-panel border border-line rounded-lg shadow-2xl
                             overflow-hidden min-w-[280px] max-h-[400px]"
                  position="popper"
                  sideOffset={6}
                >
                  <Select.Viewport className="p-1">
                    {projects
                      .filter((p) => !p.hidden)
                      .map((p) => (
                        <Select.Item
                          key={p.path}
                          value={p.path}
                          className="relative flex items-center gap-2 px-2 py-1.5 pr-7 rounded
                                     text-[12px] text-fg-muted hover:bg-bg-hover hover:text-fg-default
                                     data-[state=checked]:text-fg-default cursor-default outline-none"
                        >
                          <FolderOpen size={11} className="text-fg-subtle shrink-0" />
                          <Select.ItemText>
                            <span className="font-mono truncate">{p.path}</span>
                          </Select.ItemText>
                          <Select.ItemIndicator className="absolute right-2">
                            <Check size={11} className="text-accent" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] text-fg-faint hidden sm:inline mr-1">
              ↵ send · ⇧↵ newline
            </span>
            {onCutToNotes && (
              <button
                onClick={cutToNotes}
                disabled={!text.trim()}
                title="Move to notes"
                aria-label="Move input to notes"
                className="h-6 w-6 flex items-center justify-center rounded
                           text-fg-subtle hover:text-fg-default hover:bg-bg-hover
                           disabled:text-fg-faint disabled:cursor-not-allowed disabled:hover:bg-transparent
                           transition-colors"
              >
                <NotebookPen size={13} strokeWidth={2} />
              </button>
            )}
            <button
              onClick={submit}
              disabled={disabled || !text.trim()}
              className="h-6 w-6 flex items-center justify-center rounded
                         bg-fg-default text-bg-base hover:bg-fg-muted
                         disabled:bg-bg-hover disabled:text-fg-faint disabled:cursor-not-allowed
                         transition-colors"
              aria-label="Send"
            >
              <ArrowUp size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

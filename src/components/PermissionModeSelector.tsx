import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Shield, ShieldCheck, ShieldOff, FileEdit, ClipboardList, Zap } from 'lucide-react'
import { api } from '../lib/api'

type PermissionModeValue = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto'

type ModeOption = {
  value: PermissionModeValue
  label: string
  description: string
  icon: typeof Shield
}

const MODES: ModeOption[] = [
  { value: 'default', label: 'Default', description: 'Prompt for dangerous ops', icon: Shield },
  { value: 'auto', label: 'Auto', description: 'Smart permission decisions', icon: Zap },
  { value: 'acceptEdits', label: 'Accept Edits', description: 'Auto-allow file edits', icon: FileEdit },
  { value: 'plan', label: 'Plan Only', description: 'Plan without executing', icon: ClipboardList },
  { value: 'dontAsk', label: "Don't Ask", description: 'Skip all prompts', icon: ShieldOff },
  { value: 'bypassPermissions', label: 'Full Auto', description: 'Skip all permission checks', icon: ShieldOff },
]

type Props = {
  channelId?: string
  currentMode?: string
  onLocalChange?: (mode: PermissionModeValue) => void
}

export function PermissionModeSelector({ channelId, currentMode, onLocalChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const active = MODES.find((m) => m.value === currentMode) ?? MODES[0]
  const ActiveIcon = active.value === 'acceptEdits' ? ShieldCheck : active.icon

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg
                   text-[11px] text-fg-subtle hover:text-fg-default
                   hover:bg-bg-hover/60 transition-colors"
      >
        <ActiveIcon size={10} />
        <span className="font-mono">{active.label}</span>
        <ChevronDown size={10} className="opacity-60" />
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 z-50
                     bg-bg-panel border border-line rounded-xl shadow-2xl
                     overflow-hidden min-w-[200px] p-1"
        >
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <button
                key={m.value}
                onClick={() => {
                  if (channelId) {
                    api().setPermissionMode(channelId, m.value).catch(() => {})
                  }
                  onLocalChange?.(m.value)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left
                           text-[12px] hover:bg-bg-hover transition-colors
                           ${m.value === active.value ? 'text-fg-default font-medium' : 'text-fg-muted'}`}
              >
                <Icon size={12} className="shrink-0" />
                <div className="min-w-0">
                  <div className="truncate">{m.label}</div>
                  <div className="text-[10px] text-fg-subtle truncate">{m.description}</div>
                </div>
                {m.value === active.value && (
                  <span className="ml-auto text-accent text-[10px] shrink-0">●</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

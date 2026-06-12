import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Cpu } from 'lucide-react'
import { api } from '../lib/api'

type Props = {
  channelId: string
  currentModel?: string
}

function shortName(modelId: string): string {
  const m = modelId.toLowerCase()
  if (m.includes('opus')) return 'Opus'
  if (m.includes('sonnet')) return 'Sonnet'
  if (m.includes('haiku')) return 'Haiku'
  const parts = modelId.split('/')
  const last = parts[parts.length - 1]
  return last.length > 20 ? last.slice(0, 18) + '…' : last
}

export function ModelSelector({ channelId, currentModel }: Props) {
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    api().getModels(channelId).then(setModels).catch(() => {})
  }, [open, channelId])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const label = currentModel ? shortName(currentModel) : 'Model'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg
                   text-[11px] text-fg-subtle hover:text-fg-default
                   hover:bg-bg-hover/60 transition-colors"
      >
        <Cpu size={10} />
        <span className="font-mono">{label}</span>
        <ChevronDown size={10} className="opacity-60" />
      </button>
      {open && models.length > 0 && (
        <div
          className="absolute bottom-full left-0 mb-1 z-50
                     bg-bg-panel border border-line rounded-xl shadow-2xl
                     overflow-hidden min-w-[220px] max-h-[300px] overflow-y-auto p-1"
        >
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                api().setModel(channelId, m.id).catch(() => {})
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left
                         text-[12px] hover:bg-bg-hover transition-colors
                         ${m.id === currentModel ? 'text-fg-default font-medium' : 'text-fg-muted'}`}
            >
              <span className="font-mono truncate">{m.name || shortName(m.id)}</span>
              {m.id === currentModel && (
                <span className="ml-auto text-accent text-[10px]">●</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

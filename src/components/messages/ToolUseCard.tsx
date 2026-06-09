import { useState } from 'react'
import { ChevronRight, Wrench } from 'lucide-react'

type Props = { tool: string; input: unknown }

function summariseInput(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const obj = input as Record<string, unknown>
  // Heuristic: prefer fields that read well as a single line
  const candidates = ['command', 'file_path', 'path', 'pattern', 'query', 'url', 'description']
  for (const k of candidates) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  // Fallback: first string value
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && v.length > 0) return v
  }
  return ''
}

export function ToolUseCard({ tool, input }: Props) {
  const [open, setOpen] = useState(false)
  const summary = summariseInput(input)

  return (
    <div className="px-6 py-1.5">
      <div className="mx-auto max-w-3xl pl-9">
        <button
          onClick={() => setOpen((o) => !o)}
          className="group w-full flex items-center gap-2 text-left
                     text-[12px] text-fg-muted hover:text-fg-default transition-colors"
        >
          <ChevronRight
            size={11}
            strokeWidth={2.5}
            className={'shrink-0 text-fg-subtle transition-transform duration-150 ' + (open ? 'rotate-90' : '')}
          />
          <Wrench size={11} className="shrink-0 text-fg-subtle" />
          <span className="font-medium">{tool}</span>
          {summary && (
            <span className="font-mono text-fg-subtle truncate min-w-0">
              · {summary}
            </span>
          )}
        </button>
        {open && (
          <pre
            className="mt-1.5 ml-4 p-2.5 rounded-md bg-bg-inset border border-line/60
                       text-[11.5px] font-mono leading-[1.5] text-fg-muted
                       overflow-x-auto whitespace-pre-wrap break-all"
          >
            {JSON.stringify(input, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

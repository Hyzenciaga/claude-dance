import { Wrench, Loader2, Check, X } from 'lucide-react'
import { Collapsible } from '../Collapsible'

type Props = {
  tool: string
  input: unknown
  status?: 'pending' | 'running' | 'done' | 'error'
}

function summariseInput(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const obj = input as Record<string, unknown>
  const candidates = ['command', 'file_path', 'path', 'pattern', 'query', 'url', 'description']
  for (const k of candidates) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && v.length > 0) return v
  }
  return ''
}

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'running':
      return <Loader2 size={11} className="shrink-0 text-blue-500 animate-spin" />
    case 'done':
      return <Check size={11} className="shrink-0 text-green-600" />
    case 'error':
      return <X size={11} className="shrink-0 text-red-500" />
    default:
      return <Wrench size={11} className="shrink-0 text-fg-subtle" />
  }
}

export function ToolUseCard({ tool, input, status }: Props) {
  const summary = summariseInput(input)

  return (
    <div className="px-6 py-1.5">
      <div className="mx-auto max-w-4xl pl-9">
        <Collapsible
          trigger={
            <div className="flex items-center gap-2 text-[12px] text-fg-muted
                            hover:text-fg-default transition-colors min-w-0">
              <StatusIcon status={status} />
              <span className="font-medium">{tool}</span>
              {summary && (
                <span className="font-mono text-fg-subtle truncate min-w-0">
                  · {summary}
                </span>
              )}
            </div>
          }
        >
          <pre
            className="mt-1.5 ml-4 p-2.5 rounded-md bg-bg-inset border border-line/60
                       text-[11.5px] font-mono leading-[1.5] text-fg-muted
                       overflow-x-auto whitespace-pre-wrap break-all"
          >
            {JSON.stringify(input, null, 2)}
          </pre>
        </Collapsible>
      </div>
    </div>
  )
}

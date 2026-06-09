import { useState } from 'react'

type Props = { tool: string; input: unknown }

export function ToolUseCard({ tool, input }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%] w-full">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 bg-muted/50"
        >
          🔧 Used {tool} {open ? '▾' : '▸'}
        </button>
        {open && (
          <pre className="mt-1 text-xs bg-muted/30 border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(input, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

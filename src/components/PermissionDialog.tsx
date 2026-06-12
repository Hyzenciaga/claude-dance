import { useState, useEffect, useRef } from 'react'
import { Shield, Check, X } from 'lucide-react'
import type { PermissionRequest } from '@shared/types'

type ResponseMode = 'once' | 'always'

type Props = {
  request: PermissionRequest
  onRespond: (allowed: boolean, mode?: ResponseMode) => void
}

const TIMEOUT_SECONDS = 60

function summariseInput(input: Record<string, unknown>): string {
  const candidates = ['command', 'file_path', 'path', 'pattern', 'query', 'url', 'description']
  for (const k of candidates) {
    const v = input[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  for (const v of Object.values(input)) {
    if (typeof v === 'string' && v.length > 0) return v
  }
  return ''
}

export function PermissionDialog({ request, onRespond }: Props) {
  const summary = summariseInput(request.input)
  const [remaining, setRemaining] = useState(TIMEOUT_SECONDS)
  const respondedRef = useRef(false)

  useEffect(() => {
    setRemaining(TIMEOUT_SECONDS)
    respondedRef.current = false
  }, [request.requestId])

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          if (!respondedRef.current) {
            respondedRef.current = true
            onRespond(false)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [request.requestId, onRespond])

  function handleRespond(allowed: boolean, mode?: ResponseMode) {
    if (respondedRef.current) return
    respondedRef.current = true
    onRespond(allowed, mode)
  }

  const pct = (remaining / TIMEOUT_SECONDS) * 100
  const urgent = remaining <= 10
  const headerText = request.title || `Allow ${request.toolName}?`

  return (
    <div className="px-6 py-2">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-accent/30 bg-accent-subtle overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-accent/20">
            <Shield size={13} className="text-accent shrink-0" />
            <span className="text-[12px] font-medium text-fg-default truncate">
              {headerText}
            </span>
            {!request.title && summary && (
              <span className="text-[11.5px] font-mono text-fg-muted truncate min-w-0">
                · {summary}
              </span>
            )}
            <span className="ml-auto shrink-0 flex items-center gap-1.5">
              <span className={
                'text-[11px] tabular-nums font-medium ' +
                (urgent ? 'text-red-500' : 'text-fg-subtle')
              }>
                {remaining}s
              </span>
            </span>
          </div>
          <pre
            className="px-3 py-2 text-[11px] font-mono leading-[1.5] text-fg-muted
                       overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto"
          >
            {JSON.stringify(request.input, null, 2)}
          </pre>
          <div className="relative">
            <div
              className={'absolute top-0 left-0 h-[2px] transition-all duration-1000 linear ' +
                (urgent ? 'bg-red-500' : 'bg-accent')}
              style={{ width: `${pct}%` }}
            />
            <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-accent/20">
              <button
                onClick={() => handleRespond(false)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px]
                           text-fg-muted hover:text-fg-default
                           bg-bg-base hover:bg-bg-hover border border-line
                           transition-colors"
              >
                <X size={12} />
                Deny
              </button>
              <button
                onClick={() => handleRespond(true, 'once')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px]
                           text-fg-muted hover:text-fg-default
                           bg-bg-base hover:bg-bg-hover border border-line
                           transition-colors"
              >
                <Check size={12} />
                Allow
              </button>
              {request.sessionPattern && (
                <button
                  onClick={() => handleRespond(true, 'always')}
                  title={`Always allow "${request.sessionPattern}" commands`}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px]
                             text-white bg-accent hover:bg-accent-hover
                             transition-colors max-w-[300px] truncate"
                >
                  <Check size={12} className="shrink-0" />
                  Allow <code className="font-mono text-[11px] opacity-80 ml-0.5">{request.sessionPattern}</code>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { highlighterPromise, type Highlighter } from '../lib/shiki'
import { CopyButton } from './CopyButton'

type Props = {
  code: string
  lang: string
}

const MAX_HEIGHT = 400 // px, ~25 lines

export function CodeBlock({ code, lang }: Props) {
  const [html, setHtml] = useState<string>('')
  const [isReady, setIsReady] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const codeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    highlighterPromise.then((h: Highlighter) => {
      if (cancelled) return
      try {
        const result = h.codeToHtml(code, {
          lang: lang || 'text',
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
        })
        setHtml(result)
      } catch {
        // Language not loaded, fallback to plain text
        setHtml('')
      }
      setIsReady(true)
    })
    return () => { cancelled = true }
  }, [code, lang])

  useEffect(() => {
    if (!isReady || !codeRef.current) return
    const el = codeRef.current.querySelector('pre')
    if (el && el.scrollHeight > MAX_HEIGHT) {
      setIsOverflowing(true)
    }
  }, [isReady, html])

  const lineCount = code.split('\n').length

  return (
    <div className="code-block my-2 rounded-lg border border-line overflow-hidden group">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5
                      bg-bg-panel border-b border-line">
        <span className="text-[11px] font-medium text-fg-subtle font-mono">
          {lang || 'text'}
        </span>
        <div className="flex items-center gap-1">
          {isOverflowing && (
            <button
              onClick={() => setExpanded((o) => !o)}
              className="text-[11px] text-fg-muted hover:text-fg-default
                         px-1.5 py-0.5 rounded hover:bg-bg-hover transition-colors"
            >
              {expanded ? 'Collapse' : `${lineCount} lines`}
            </button>
          )}
          <CopyButton text={code} label="Copy code" />
        </div>
      </div>

      {/* Code body */}
      <div
        ref={codeRef}
        className="relative overflow-auto bg-bg-inset"
        style={{ maxHeight: isOverflowing && !expanded ? `${MAX_HEIGHT}px` : undefined }}
      >
        {isReady && html ? (
          <div
            className="shiki-code"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="p-3 text-[12.5px] leading-[1.55] font-mono text-fg-muted overflow-x-auto">
            <code>{code}</code>
          </pre>
        )}

        {/* Gradient fade when collapsed */}
        {isOverflowing && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12
                          bg-gradient-to-t from-bg-inset to-transparent
                          pointer-events-none" />
        )}
      </div>
    </div>
  )
}

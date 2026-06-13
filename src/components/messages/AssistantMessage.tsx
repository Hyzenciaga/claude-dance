import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '../CodeBlock'
import { MessageActions } from '../MessageActions'

type Props = {
  text: string
  isStreaming?: boolean
  showActions?: boolean
}

export function AssistantMessage({ text, isStreaming, showActions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Track if this is a new message for entrance animation
  const isNew = useRef(true)
  useEffect(() => { isNew.current = false }, [])

  return (
    <div className={'px-6 py-2.5 group/msg' + (isNew.current ? ' message-enter' : '')}>
      <div className="mx-auto max-w-4xl flex justify-start">
        <div
          ref={containerRef}
          className={'w-full rounded-2xl rounded-tl-sm px-3.5 py-2 ' +
                     'bg-bubble-assistant border border-bubble-assistant-border ' +
                     'text-fg-default text-[13.5px] leading-[1.6] shadow-sm ' +
                     'markdown overflow-hidden' +
                     (isStreaming ? ' streaming-cursor' : '')}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li className="leading-[1.55]">{children}</li>,
              h1: ({ children }) => <h1 className="text-[16px] font-semibold mt-3 mb-1.5">{children}</h1>,
              h2: ({ children }) => <h2 className="text-[15px] font-semibold mt-2.5 mb-1.5">{children}</h2>,
              h3: ({ children }) => <h3 className="text-[14px] font-semibold mt-2 mb-1">{children}</h3>,
              a: ({ href, children }) => (
                <a href={href} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              pre: ({ children }) => {
                // Extract code and lang from the nested <code> element
                const codeEl = children as React.ReactElement<{
                  className?: string
                  children?: string
                }>
                const className = codeEl?.props?.className ?? ''
                const code = String(codeEl?.props?.children ?? '').replace(/\n$/, '')
                const lang = className.replace('language-', '') || ''
                if (code) return <CodeBlock code={code} lang={lang} />
                return <pre>{children}</pre>
              },
              code: ({ className, children }) => {
                const isBlock = /language-/.test(className ?? '')
                if (isBlock) return <code>{children}</code>
                return (
                  <code className="font-mono text-[12.5px] px-1 py-0.5 rounded
                                   bg-bg-hover text-fg-default border border-line/60">
                    {children}
                  </code>
                )
              },
              blockquote: ({ children }) => (
                <blockquote className="my-2 pl-3 border-l-2 border-line-strong text-fg-muted">
                  {children}
                </blockquote>
              ),
              hr: () => <hr className="my-3 border-line" />,
              table: ({ children }) => (
                <div className="my-2 overflow-x-auto">
                  <table className="min-w-full text-[12.5px] border-collapse">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="text-left font-semibold px-2 py-1 border-b border-line">{children}</th>
              ),
              td: ({ children }) => <td className="px-2 py-1 border-b border-line/40">{children}</td>,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      </div>

      {/* Message actions bar */}
      {showActions && (
        <div className="mx-auto max-w-4xl flex justify-start mt-1">
          <MessageActions text={text} />
        </div>
      )}
    </div>
  )
}

import { useRef, useEffect } from 'react'
import { Copy, Pencil } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCopyToClipboard } from '../../lib/useCopyToClipboard'

type Props = {
  text: string
  onEditResend?: (text: string) => void
}

export function UserMessage({ text, onEditResend }: Props) {
  const { copied, copy } = useCopyToClipboard()

  const isNew = useRef(true)
  useEffect(() => { isNew.current = false }, [])

  return (
    <div className={'px-6 py-2.5 group/user' + (isNew.current ? ' message-enter' : '')}>
      <div className="mx-auto max-w-4xl flex items-start justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2
                        bg-bubble-user text-bubble-user-fg text-[13.5px]
                        leading-[1.55] shadow-sm user-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="my-0.5 first:mt-0 last:mb-0">{children}</p>,
              code: ({ className, children }) => {
                const isBlock = /language-/.test(className ?? '')
                if (isBlock) return <code className="block font-mono text-[12px]">{children}</code>
                return (
                  <code className="font-mono text-[12px] px-1 py-0.5 rounded
                                   bg-white/10 text-inherit">
                    {children}
                  </code>
                )
              },
              a: ({ href, children }) => (
                <a href={href} className="underline decoration-white/30 hover:decoration-white/60"
                   target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      </div>

      {/* Actions below message — hidden, show on hover */}
      <div className="mx-auto max-w-4xl flex justify-end mt-1
                      opacity-0 group-hover/user:opacity-100 transition-opacity">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => copy(text)}
            className="h-6 flex items-center gap-1 px-1.5 rounded-md
                       text-[11px] text-fg-subtle hover:text-fg-default hover:bg-bg-hover
                       transition-colors"
            title="Copy message"
          >
            <Copy size={11} strokeWidth={2} />
            {copied ? <span className="text-green-600">Copied</span> : <span>Copy</span>}
          </button>
          {onEditResend && (
            <button
              onClick={() => onEditResend(text)}
              className="h-6 flex items-center gap-1 px-1.5 rounded-md
                         text-[11px] text-fg-subtle hover:text-fg-default hover:bg-bg-hover
                         transition-colors"
              title="Edit & resend"
            >
              <Pencil size={11} strokeWidth={2} />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

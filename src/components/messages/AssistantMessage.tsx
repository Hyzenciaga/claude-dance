import { useRef, useEffect } from 'react'
import { Streamdown } from 'streamdown'
import { createCodePlugin } from '@streamdown/code'
import { MessageActions } from '../MessageActions'

const codePlugin = createCodePlugin({
  themes: ['github-light', 'github-dark'],
})

type Props = {
  text: string
  isStreaming?: boolean
  showActions?: boolean
}

export function AssistantMessage({ text, isStreaming, showActions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isNew = useRef(true)
  useEffect(() => { isNew.current = false }, [])

  // Inject our own copy buttons into streamdown code blocks
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function createCopyBtn(block: Element) {
      const btn = document.createElement('button')
      btn.className = 'cd-copy-btn'
      btn.textContent = 'Copy'
      btn.style.cssText = 'font-size:11px;color:var(--color-fg-subtle,#8b8b8b);' +
        'background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px;'
      btn.onmouseenter = () => { btn.style.color = 'var(--color-fg-default,#e0e0e0)' }
      btn.onmouseleave = () => { btn.style.color = 'var(--color-fg-subtle,#8b8b8b)' }
      btn.onclick = async () => {
        const codeEl = block.querySelector('.code-block-body code, pre code, code')
        if (!codeEl) return
        try {
          await navigator.clipboard.writeText(codeEl.textContent ?? '')
        } catch {
          const ta = document.createElement('textarea')
          ta.value = codeEl.textContent ?? ''
          ta.style.cssText = 'position:fixed;left:-9999px;opacity:0'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        btn.textContent = 'Copied'
        btn.style.color = '#16a34a'
        setTimeout(() => {
          btn.textContent = 'Copy'
          btn.style.color = 'var(--color-fg-subtle,#8b8b8b)'
        }, 2000)
      }
      return btn
    }

    function injectButtons() {
      const blocks = container!.querySelectorAll('.code-block')
      blocks.forEach((block) => {
        if (block.querySelector('.cd-copy-btn')) return
        const header = block.querySelector('.code-block-header')
        if (header) {
          header.appendChild(createCopyBtn(block))
        }
      })
    }

    // Debounce to avoid excessive calls during rapid streaming
    let timer: ReturnType<typeof setTimeout>
    function debouncedInject() {
      clearTimeout(timer)
      timer = setTimeout(injectButtons, 50)
    }

    injectButtons()
    const observer = new MutationObserver(debouncedInject)
    observer.observe(container, { childList: true, subtree: true, characterData: true })
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [])

  return (
    <div className={'px-6 py-2.5 group/msg' + (isNew.current ? ' message-enter' : '')}>
      <div className="mx-auto max-w-4xl flex justify-start">
        <div
          ref={containerRef}
          className={'w-full rounded-2xl rounded-tl-sm px-3.5 py-2 ' +
                     'bg-bubble-assistant border border-bubble-assistant-border ' +
                     'text-fg-default text-[13.5px] leading-[1.6] shadow-sm ' +
                     'markdown overflow-hidden'}
        >
          <Streamdown
            mode={isStreaming ? 'streaming' : 'static'}
            plugins={{ code: codePlugin }}
            shikiTheme={['github-light', 'github-dark']}
            lineNumbers
            controls={false}
            caret={isStreaming ? 'block' : undefined}
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
              inlineCode: ({ children }) => (
                <code className="font-mono text-[12.5px] px-1 py-0.5 rounded
                                 bg-bg-hover text-fg-default border border-line/60">
                  {children}
                </code>
              ),
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
          </Streamdown>
        </div>
      </div>

      {/* Message actions — hidden, show on hover */}
      {showActions && (
        <div className="mx-auto max-w-4xl flex justify-start mt-1">
          <MessageActions text={text} />
        </div>
      )}
    </div>
  )
}

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = { text: string }

export function AssistantMessage({ text }: Props) {
  return (
    <div className="px-6 py-4 bg-bg-panel/40">
      <div className="mx-auto max-w-3xl flex gap-3">
        <div className="flex-shrink-0 w-6 h-6 rounded bg-accent/15 flex items-center justify-center
                        text-[10px] font-semibold text-accent uppercase tracking-wide">
          C
        </div>
        <div className="flex-1 min-w-0 pt-0.5 overflow-hidden">
          <div className="text-[11px] text-fg-subtle mb-1 font-medium">Claude</div>
          <div className="markdown text-[13.5px] text-fg-default leading-[1.65]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-[1.55]">{children}</li>,
                h1: ({ children }) => <h1 className="text-[16px] font-semibold mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-[15px] font-semibold mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-[14px] font-semibold mt-3 mb-1.5">{children}</h3>,
                a: ({ href, children }) => (
                  <a href={href} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
                strong: ({ children }) => <strong className="font-semibold text-fg-default">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ className, children }) => {
                  const isBlock = /language-/.test(className ?? '')
                  if (isBlock) {
                    return (
                      <code className="block font-mono text-[12.5px] leading-[1.5]">
                        {children}
                      </code>
                    )
                  }
                  return (
                    <code className="font-mono text-[12.5px] px-1 py-0.5 rounded
                                     bg-bg-hover text-fg-default border border-line/60">
                      {children}
                    </code>
                  )
                },
                pre: ({ children }) => (
                  <pre className="my-3 p-3 rounded-md bg-bg-base border border-line
                                  overflow-x-auto text-[12.5px] leading-[1.55]">
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-2 pl-3 border-l-2 border-line text-fg-muted">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-4 border-line" />,
                table: ({ children }) => (
                  <div className="my-3 overflow-x-auto">
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
      </div>
    </div>
  )
}

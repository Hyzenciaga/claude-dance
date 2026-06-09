import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = { text: string }

export function AssistantMessage({ text }: Props) {
  return (
    <div className="px-6 py-2.5">
      <div className="mx-auto max-w-3xl flex justify-start">
        <div className="max-w-[88%] rounded-2xl rounded-tl-sm px-3.5 py-2
                        bg-bubble-assistant border border-bubble-assistant-border
                        text-fg-default text-[13.5px] leading-[1.6] shadow-sm
                        markdown overflow-hidden">
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
                <pre className="my-2 p-2.5 rounded-md bg-bg-panel border border-line
                                overflow-x-auto text-[12.5px] leading-[1.55]">
                  {children}
                </pre>
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
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

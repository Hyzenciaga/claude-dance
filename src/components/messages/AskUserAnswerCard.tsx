import { MessageSquareCheck } from 'lucide-react'
import type { AnswerPair } from '../../lib/derive'

type Props = {
  pairs: AnswerPair[]
  response?: string
}

export function AskUserAnswerCard({ pairs, response }: Props) {
  return (
    <div className="px-6 py-1.5">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-line bg-bg-inset overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-line">
            <MessageSquareCheck size={12} className="text-fg-subtle shrink-0" />
            <span className="text-[11px] font-medium text-fg-subtle">Answered</span>
          </div>
          <div className="px-3 py-2 flex flex-col gap-2">
            {pairs.map((p) => (
              <div key={p.question}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint bg-bg-panel border border-line px-1 py-0.5 rounded">
                    {p.header}
                  </span>
                  <span className="text-[11px] text-fg-subtle truncate">{p.question}</span>
                </div>
                <div className="ml-0 text-[12px] text-fg-default font-medium">
                  {p.answer || <span className="text-fg-faint italic">—</span>}
                </div>
              </div>
            ))}
            {response && (
              <div className="mt-1 pt-2 border-t border-line">
                <div className="text-[11px] text-fg-subtle mb-0.5">Notes</div>
                <div className="text-[12px] text-fg-default">{response}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

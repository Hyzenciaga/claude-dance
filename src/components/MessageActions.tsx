import { Copy } from 'lucide-react'
import { useCopyToClipboard } from '../lib/useCopyToClipboard'

type Props = {
  text: string
}

export function MessageActions({ text }: Props) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
      <button
        onClick={() => copy(text)}
        className="h-6 flex items-center gap-1 px-1.5 rounded-md
                   text-[11px] text-fg-subtle hover:text-fg-default hover:bg-bg-hover
                   transition-colors"
        title="Copy message"
      >
        <Copy size={11} strokeWidth={2} />
        {copied ? (
          <span className="text-green-600">Copied</span>
        ) : (
          <span>Copy</span>
        )}
      </button>
    </div>
  )
}

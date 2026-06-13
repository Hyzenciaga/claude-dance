import { Copy, Check } from 'lucide-react'
import { useCopyToClipboard } from '../lib/useCopyToClipboard'

type Props = {
  text: string
  label?: string
}

export function CopyButton({ text, label }: Props) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <button
      onClick={() => copy(text)}
      className="h-6 w-6 flex items-center justify-center rounded-md
                 text-fg-subtle hover:text-fg-default hover:bg-bg-hover
                 transition-colors"
      title={copied ? 'Copied!' : label ?? 'Copy'}
      aria-label={copied ? 'Copied!' : label ?? 'Copy'}
    >
      {copied ? (
        <Check size={13} strokeWidth={2.5} className="text-green-600" />
      ) : (
        <Copy size={12} strokeWidth={2} />
      )}
    </button>
  )
}

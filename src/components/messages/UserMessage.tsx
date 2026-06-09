type Props = { text: string }

export function UserMessage({ text }: Props) {
  return (
    <div className="px-6 py-4">
      <div className="mx-auto max-w-3xl flex gap-3">
        <div className="flex-shrink-0 w-6 h-6 rounded bg-bg-hover flex items-center justify-center
                        text-[10px] font-semibold text-fg-muted uppercase tracking-wide">
          U
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[11px] text-fg-subtle mb-1 font-medium">You</div>
          <div className="text-[13.5px] text-fg-default whitespace-pre-wrap leading-[1.6]">
            {text}
          </div>
        </div>
      </div>
    </div>
  )
}

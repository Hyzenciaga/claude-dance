type Props = { text: string }
export function AssistantMessage({ text }: Props) {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%] rounded-2xl px-4 py-2 bg-muted text-foreground whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}

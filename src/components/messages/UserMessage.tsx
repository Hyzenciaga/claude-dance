type Props = { text: string }
export function UserMessage({ text }: Props) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[75%] rounded-2xl px-4 py-2 bg-primary text-primary-foreground whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}

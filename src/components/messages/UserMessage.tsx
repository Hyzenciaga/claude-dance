type Props = { text: string }

export function UserMessage({ text }: Props) {
  return (
    <div className="px-6 py-2.5">
      <div className="mx-auto max-w-3xl flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-tr-sm px-3.5 py-2
                        bg-bubble-user text-bubble-user-fg text-[13.5px]
                        leading-[1.55] whitespace-pre-wrap shadow-sm">
          {text}
        </div>
      </div>
    </div>
  )
}

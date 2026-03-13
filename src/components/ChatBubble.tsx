"use client";

interface ChatBubbleProps {
  role: "assistant" | "user";
  content: string;
}

export default function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-3 ${
          isUser
            ? "text-white rounded-br-md"
            : "bg-faint-gray text-charcoal rounded-bl-md"
        }`}
        style={isUser ? { background: "var(--color-brand)" } : undefined}
      >
        {!isUser && (
          <span className="text-xs font-semibold text-brand block mb-1">
            Nuuge
          </span>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

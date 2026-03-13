"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";
import { ONBOARDING_OPENER, RECIPIENT_OPENER } from "@/lib/ai/prompts";
import type { ConversationMessage } from "@/types/database";
import { logApiCall } from "@/lib/usage-store";

interface ConversationFlowProps {
  mode: "onboarding" | "recipient";
  userContext?: string;
  initialHistory?: ConversationMessage[];
  onComplete: (extractedContext: Record<string, unknown>) => void;
  onHistoryChange?: (messages: ConversationMessage[]) => void;
}

export default function ConversationFlow({
  mode,
  userContext,
  initialHistory = [],
  onComplete,
  onHistoryChange,
}: ConversationFlowProps) {
  const openers = mode === "onboarding" ? ONBOARDING_OPENER : RECIPIENT_OPENER;
  const startingMessages = initialHistory.length > 0 ? initialHistory : openers;
  const [messages, setMessages] = useState<ConversationMessage[]>(startingMessages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (onHistoryChange) {
      onHistoryChange(messages);
    }
  }, [messages, onHistoryChange]);

  const callAI = useCallback(
    async (history: ConversationMessage[]) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            conversationHistory: history,
            userContext,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to get response");
        }

        const data = await res.json();
        logApiCall("chat", { model: "gpt-4o", callType: "chat_completion" });

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);

        if (data.isComplete && data.extractedContext) {
          onComplete(data.extractedContext);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [mode, userContext, onComplete]
  );

  async function handleSend(text: string) {
    const userMessage: ConversationMessage = { role: "user", content: text };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    await callAI(updatedHistory);
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-5 py-3">
              <span className="text-xs font-semibold text-brand block mb-1">
                Nuuge
              </span>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            <button
              onClick={() => callAI(messages)}
              className="ml-2 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
      <ChatInput
        onSend={handleSend}
        disabled={loading}
        placeholder={
          mode === "onboarding"
            ? "Tell Nuuge about yourself..."
            : "Tell Nuuge about this person..."
        }
      />
    </div>
  );
}

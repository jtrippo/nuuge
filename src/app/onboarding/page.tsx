"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ConversationFlow from "@/components/ConversationFlow";
import {
  saveUserProfile,
  getUserProfile,
  getOnboardingHistory,
  saveOnboardingHistory,
  clearOnboardingHistory,
} from "@/lib/store";
import type { ConversationMessage } from "@/types/database";

export default function OnboardingPage() {
  const router = useRouter();
  const existingProfile = getUserProfile();
  const initialHistory = getOnboardingHistory();
  const [completed, setCompleted] = useState(
    existingProfile?.onboarding_complete ?? false
  );
  const [showIntro, setShowIntro] = useState(initialHistory.length === 0);

  const handleComplete = useCallback((context: Record<string, unknown>) => {
    saveUserProfile({
      display_name: context.display_name as string,
      personality: context.personality as string,
      humor_style: (context.humor_style as string) || null,
      interests: context.interests as string[],
      values: context.values as string[],
      birthday: (context.birthday as string) || null,
      lifestyle: (context.lifestyle as string) || null,
      partner_name: (context.partner_name as string) || null,
      context_raw: JSON.stringify(context),
      onboarding_complete: true,
    });
    clearOnboardingHistory();
    setCompleted(true);
  }, []);

  const handleHistoryChange = useCallback((messages: ConversationMessage[]) => {
    saveOnboardingHistory(messages);
  }, []);

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#10024;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            You&apos;re all set!
          </h1>
          <p className="text-gray-600 mb-8">
            Nuuge knows you now. Next, tell us about the people you want to send
            cards to — we&apos;ll have a quick chat about each one.
          </p>
          <button
            onClick={() => router.push("/recipients/new")}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                       hover:bg-indigo-700 transition-colors mr-3"
          >
            Add someone
          </button>
          <button
            onClick={() => router.push("/")}
            className="bg-white text-indigo-600 border border-indigo-200 px-8 py-3 rounded-xl
                       font-medium hover:bg-indigo-50 transition-colors"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (showIntro) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white px-4">
        <div className="max-w-lg text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Welcome to Nuuge
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Cards that actually sound like you.
          </p>

          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8 text-left">
            <h2 className="text-md font-semibold text-gray-900 mb-4">
              Here&apos;s how this works
            </h2>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="flex gap-3">
                <span className="text-indigo-500 font-bold text-base mt-[-2px]">1</span>
                <p>
                  <span className="font-medium text-gray-800">We&apos;ll have a quick chat.</span>{" "}
                  Nuuge will ask you a few things about yourself — your personality,
                  what you&apos;re into, how you like to communicate. Think of it
                  like talking to a friend, not filling out a form.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-500 font-bold text-base mt-[-2px]">2</span>
                <p>
                  <span className="font-medium text-gray-800">Then you&apos;ll add your people.</span>{" "}
                  For each person you want to send cards to — spouse, kid, parent,
                  friend — we&apos;ll have a similar chat so Nuuge understands
                  them and your relationship.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-500 font-bold text-base mt-[-2px]">3</span>
                <p>
                  <span className="font-medium text-gray-800">Nuuge creates cards for you.</span>{" "}
                  Using everything it knows about you and the recipient, Nuuge
                  writes messages and designs cards that feel genuinely personal —
                  no templates, no generic fluff.
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-400 mb-6">
            The first chat takes about 2-3 minutes. Just be yourself — there
            are no wrong answers.
          </p>

          <button
            onClick={() => setShowIntro(false)}
            className="bg-indigo-600 text-white px-10 py-4 rounded-xl text-lg font-medium
                       hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            Let&apos;s chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">
          Getting to know you
        </h1>
        <p className="text-sm text-gray-500">
          Just chat naturally — Nuuge is building a picture of who you are
        </p>
      </header>
      <div className="flex-1 overflow-hidden">
        <ConversationFlow
          mode="onboarding"
          initialHistory={initialHistory}
          onComplete={handleComplete}
          onHistoryChange={handleHistoryChange}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ConversationFlow from "@/components/ConversationFlow";
import { getUserProfile, saveRecipient } from "@/lib/store";

export default function NewRecipientPage() {
  const router = useRouter();
  const userProfile = getUserProfile();
  const [completed, setCompleted] = useState(false);
  const [recipientName, setRecipientName] = useState("");

  const userContextSummary = userProfile
    ? `Name: ${userProfile.display_name || "Unknown"}
Personality: ${userProfile.personality || "Not specified"}
Humor style: ${userProfile.humor_style || "Not specified"}
Interests: ${(userProfile.interests || []).join(", ") || "Not specified"}
Values: ${(userProfile.values || []).join(", ") || "Not specified"}
Communication style: ${userProfile.communication_style || "Not specified"}`
    : "No user context available yet.";

  const handleComplete = useCallback(
    (context: Record<string, unknown>) => {
      const name = context.name as string;
      setRecipientName(name);
      saveRecipient({
        user_id: "local",
        name,
        relationship_type: context.relationship_type as string,
        personality_notes: context.personality_notes as string,
        interests: context.interests as string[],
        humor_tolerance: context.humor_tolerance as string,
        tone_preference: context.tone_preference as string,
        important_dates: context.important_dates as {
          label: string;
          date: string;
          recurring: boolean;
        }[],
        milestones: context.milestones as string[],
        context_raw: JSON.stringify(context),
      });
      setCompleted(true);
    },
    []
  );

  if (!userProfile?.onboarding_complete) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Hold on — we haven&apos;t met yet!
          </h1>
          <p className="text-gray-600 mb-8">
            Before adding recipients, let Nuuge get to know you first. It helps
            us create cards that truly sound like you.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                       hover:bg-indigo-700 transition-colors"
          >
            Let&apos;s get started
          </button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#127881;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {recipientName} is all set!
          </h1>
          <p className="text-gray-600 mb-8">
            Nuuge now knows enough to create personalized cards for{" "}
            {recipientName}. You can add more people or head to the dashboard.
          </p>
          <button
            onClick={() => router.push("/recipients/new")}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                       hover:bg-indigo-700 transition-colors mr-3"
          >
            Add another person
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

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Add a recipient
            </h1>
            <p className="text-sm text-gray-500">
              Tell Nuuge about someone you&apos;d like to send cards to
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <ConversationFlow
          mode="recipient"
          userContext={userContextSummary}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}

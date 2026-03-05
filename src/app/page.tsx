"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserProfile, getRecipients } from "@/lib/store";
import type { UserProfile, Recipient } from "@/types/database";

function getUpcomingDates(recipients: Recipient[]) {
  const today = new Date();
  const currentYear = today.getFullYear();

  const upcoming: { recipientName: string; label: string; date: Date; daysAway: number }[] = [];

  for (const r of recipients) {
    for (const d of r.important_dates || []) {
      const parts = d.date.split("-");
      let month: number, day: number;

      if (parts.length === 3) {
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        month = parseInt(parts[0], 10) - 1;
        day = parseInt(parts[1], 10);
      }

      if (isNaN(month) || isNaN(day)) continue;

      let nextOccurrence = new Date(currentYear, month, day);
      if (nextOccurrence < today) {
        nextOccurrence = new Date(currentYear + 1, month, day);
      }

      const daysAway = Math.ceil(
        (nextOccurrence.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysAway <= 90) {
        upcoming.push({
          recipientName: r.name,
          label: d.label,
          date: nextOccurrence,
          daysAway,
        });
      }
    }
  }

  return upcoming.sort((a, b) => a.daysAway - b.daysAway);
}

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setProfile(getUserProfile());
    setRecipients(getRecipients());
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!profile?.onboarding_complete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-indigo-50 to-white px-4 py-16">
        <div className="text-center max-w-xl">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">nuuge</h1>
          <p className="text-xl text-gray-600 mb-4">
            Cards that actually sound like you.
          </p>
          <p className="text-gray-500 mb-10 max-w-md mx-auto leading-relaxed">
            Nuuge uses AI to create greeting cards that feel genuinely personal.
            You tell us about yourself and the people you care about through a
            simple conversation — and we handle the rest. The messages, the
            design, the delivery. No templates. Every card is one of a kind.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 text-left max-w-lg mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl mb-2">&#128172;</div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Chat with Nuuge</h3>
              <p className="text-xs text-gray-500">
                A quick conversation so we understand your personality and style
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl mb-2">&#128101;</div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Add your people</h3>
              <p className="text-xs text-gray-500">
                Tell us about each person — their interests, your dynamic, the vibe
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl mb-2">&#127912;</div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Create cards</h3>
              <p className="text-xs text-gray-500">
                Nuuge writes and designs cards that land — send digitally or by mail
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/onboarding")}
            className="bg-indigo-600 text-white px-10 py-4 rounded-xl text-lg font-medium
                       hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            Get started
          </button>
          <p className="text-xs text-gray-400 mt-4">
            Takes about 5 minutes to set up. Free to try.
          </p>
        </div>
      </div>
    );
  }

  const upcomingDates = getUpcomingDates(recipients);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">nuuge</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/backup")}
              className="text-sm text-gray-400 hover:text-indigo-600 transition-colors"
            >
              Backup
            </button>
            <button
              onClick={() => router.push("/profile")}
              className="text-sm text-gray-500 hover:text-indigo-600 transition-colors"
            >
              {profile.display_name} &middot; My profile
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Upcoming dates */}
        {upcomingDates.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Coming up
            </h2>
            <div className="grid gap-3">
              {upcomingDates.map((event, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white border border-gray-200
                             rounded-xl px-5 py-4 hover:border-indigo-300 transition-colors"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {event.recipientName}
                    </span>
                    <span className="text-gray-400 mx-2">&middot;</span>
                    <span className="text-gray-600">{event.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-medium ${
                        event.daysAway <= 7
                          ? "text-red-600"
                          : event.daysAway <= 30
                          ? "text-amber-600"
                          : "text-gray-500"
                      }`}
                    >
                      {event.daysAway === 0
                        ? "Today!"
                        : event.daysAway === 1
                        ? "Tomorrow"
                        : `${event.daysAway} days`}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const all = recipients;
                        const match = all.find((r) => r.name === event.recipientName);
                        if (match) router.push(`/cards/create/${match.id}`);
                      }}
                      className="text-sm text-indigo-600 font-medium hover:text-indigo-800"
                    >
                      Create card
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recipients */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your people</h2>
            <button
              onClick={() => router.push("/recipients/new")}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              + Add someone
            </button>
          </div>

          {recipients.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-xl">
              <p className="text-gray-500 mb-4">
                No one here yet. Add someone to start creating cards.
              </p>
              <button
                onClick={() => router.push("/recipients/new")}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium
                           hover:bg-indigo-700 transition-colors"
              >
                Add your first person
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recipients.map((r) => (
                <div
                  key={r.id}
                  onClick={() => router.push(`/recipients/${r.id}`)}
                  className="bg-white border border-gray-200 rounded-xl px-5 py-4
                             hover:border-indigo-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{r.name}</h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {r.relationship_type}
                      </p>
                    </div>
                    {r.tone_preference && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full">
                        {r.tone_preference}
                      </span>
                    )}
                  </div>
                  {r.interests && r.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {r.interests.slice(0, 4).map((interest, i) => (
                        <span
                          key={i}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                        >
                          {interest}
                        </span>
                      ))}
                      {r.interests.length > 4 && (
                        <span className="text-xs text-gray-400">
                          +{r.interests.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-3">
                    Click to view all details
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

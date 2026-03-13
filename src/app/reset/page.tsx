"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPage() {
  const router = useRouter();
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    localStorage.removeItem("nuuge_user_profile");
    localStorage.removeItem("nuuge_recipients");
    localStorage.removeItem("nuuge_onboarding_history");
    setCleared(true);
  }, []);

  if (!cleared) return null;

  return (
    <div
      className="flex flex-col items-center justify-center h-screen px-4"
      style={{ background: "var(--color-cream)" }}
    >
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">&#9989;</div>
        <h1 className="text-2xl font-semibold text-charcoal mb-3">All cleared!</h1>
        <p className="text-warm-gray mb-8">
          Your data has been reset. Ready to start fresh.
        </p>
        <button
          onClick={() => router.push("/")}
          className="btn-primary"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}

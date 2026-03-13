"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#FAF8F5" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1
            style={{ fontSize: "1.5rem", fontWeight: 600, color: "#3A3A3A", marginBottom: "0.5rem" }}
          >
            Something went wrong
          </h1>
          <p style={{ color: "#8B8178", marginBottom: "1.5rem", maxWidth: "24rem", fontSize: "0.875rem" }}>
            Nuuge encountered an unexpected error. Your data is safe.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1.5rem",
              borderRadius: "9999px",
              border: "1.5px solid #7B9E87",
              background: "#3A7D5C",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

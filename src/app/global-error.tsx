"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", padding: 32 }}>
        <h1>Something went wrong</h1>
        <p>Reference: {error.digest ?? "n/a"}</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}

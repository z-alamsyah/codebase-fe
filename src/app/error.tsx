"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-lg space-y-3 p-8">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">Reference: {error.digest ?? "n/a"}</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}

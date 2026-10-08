"use client";

import { Button } from "@/components/ui/button";

export default function TenantError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="space-y-3">
      <p className="text-destructive">Something went wrong. Reference: {error.digest ?? "n/a"}</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

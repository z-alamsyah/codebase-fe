"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Ends the local session and the Zitadel session (see /api/auth/logout). */
export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const { url } = (await res.json()) as { url: string };
      window.location.assign(url);
    } catch {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void logout()}>
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}

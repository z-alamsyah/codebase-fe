"use client";

import { getCsrfToken } from "@zitadel/next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    void getCsrfToken().then((t) => setCsrfToken(t ?? ""));
  }, []);

  // Auth.js starts the OIDC flow on a POST with a CSRF token.
  return (
    <form method="post" action="/api/auth/signin/zitadel">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {params.get("error") && <p className="text-destructive mb-3 text-sm">Login failed, please try again.</p>}
      <Button type="submit" disabled={!csrfToken} className="w-full">
        Login with Zitadel
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm p-8">
      <Card>
        <CardHeader>
          <CardTitle>Log in</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

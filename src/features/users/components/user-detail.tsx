"use client";

import Link from "next/link";
import { ApiError, userMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "../api/queries";

export function UserDetail({ tenant, id }: { tenant: string; id: string }) {
  const { data, error, isPending, refetch } = useUser(tenant, id);

  if (isPending) return <p className="text-muted-foreground">Loading user…</p>;

  if (error) {
    const err = ApiError.from(error);
    return (
      <div role="alert" className="space-y-3">
        <p className="text-destructive">{err.code === "NOT_FOUND" ? "User not found." : userMessage(err)}</p>
        {!err.isClientError && (
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  const user = data.data;
  if (!user) return <p className="text-muted-foreground">No data.</p>;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle data-testid="user-name">{user.name}</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>Phone: {user.phone || "-"}</p>
        <p>Created: {new Date(user.created_at).toLocaleString()}</p>
        <p className="text-muted-foreground">ID: {user.id}</p>
        <Link className="text-primary underline-offset-4 hover:underline" href={`/${tenant}/users/new`}>
          Create another user
        </Link>
      </CardContent>
    </Card>
  );
}

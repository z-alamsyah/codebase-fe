import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-3 p-8">
      <h1 className="text-2xl font-semibold">403: No access</h1>
      <p className="text-muted-foreground">You are not a member of this tenant, or your role does not allow this.</p>
      <Link className="text-primary underline-offset-4 hover:underline" href="/">
        Back to home
      </Link>
    </main>
  );
}

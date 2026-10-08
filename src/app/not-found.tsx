import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-3 p-8">
      <h1 className="text-2xl font-semibold">404: Page not found</h1>
      <Link className="text-primary underline-offset-4 hover:underline" href="/">
        Back to home
      </Link>
    </main>
  );
}
